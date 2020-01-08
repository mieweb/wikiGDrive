'use strict';

import { google } from 'googleapis';
import slugify from 'slugify';
import {retryAsync} from './retryAsync';

const MAX_FILENAME_LENGTH = 100;

export function getDesiredPath(name) {
  name = name.replace(/[&]+/g, ' and ');
  name = name.replace(/[/:()]+/g, ' ');
  name = name.trim();
  name = slugify(name, { replacement: '-', lower: true });
  return name;
}

export class GoogleDriveService {
  constructor(params) {
    this.params = params;
  }


  urlToFolderId(url) {
    if (url.match(/drive\.google\.com\/drive.*folders\//)) {
      let id = url.substr(url.indexOf('/folders/') + '/folders/'.length);
      if (id.indexOf('/') > 0) {
        id = id.substr(0, id.indexOf('/'));
      }
      if (id.indexOf('?') > 0) {
        id = id.substr(0, id.indexOf('?'));
      }
      if (id.indexOf('&') > 0) {
        id = id.substr(0, id.indexOf('&'));
      }
      return id;
    }

    if (url.indexOf('https://drive.google.com/open?id%3D') > -1) {
      url = url.replace('https://drive.google.com/open?id%3D', 'https://drive.google.com/open?id=');
    }

    if (url.indexOf('https://drive.google.com/open?id=') > -1) {
      let id = url.substr(url.indexOf('https://drive.google.com/open?id=') + 'https://drive.google.com/open?id='.length);
      if (id.indexOf('&') > 0) {
        id = id.substr(0, id.indexOf('&'));
      }
      return id;
    }

    if (url.indexOf('docs.google.com/document/d/') > 0) {
      let id = url.substr(url.indexOf('docs.google.com/document/d/') + 'docs.google.com/document/d/'.length);
      if (id.indexOf('/') > 0) {
        id = id.substr(0, id.indexOf('/'));
      }
      if (id.indexOf('?') > 0) {
        id = id.substr(0, id.indexOf('?'));
      }
      if (id.indexOf('&') > 0) {
        id = id.substr(0, id.indexOf('&'));
      }
      return id;
    }

    return false;
  }

  removeDuplicates(files) {
    const retVal = [];

    files.sort((a, b) => {
      return -(a.desiredLocalPath.length - b.desiredLocalPath.length);
    });

    for (const file of files) {
      if (retVal.find(entry => entry.id === file.id)) {
        continue;
      }
      retVal.push(file);
    }

    return retVal;
  }

  async listFilesRecursive(auth, folderId, modifiedTime, parentDirName) {
    let files = await this.listFiles(auth, folderId, modifiedTime);

    console.log('Listening folder:', parentDirName || '/');

    if (parentDirName && !this.params['flat-folder-structure']) {
      files.forEach(file => {
        const slugifiedParent = parentDirName
          .split('/')
          .map(part => getDesiredPath(part))
          .join('/');

        file.desiredLocalPath = slugifiedParent + '/' + file.desiredLocalPath;
      });
    }

    for (let fileNo = 0; fileNo < files.length; fileNo++) {
      const file = files[fileNo];
      if (file.mimeType !== 'application/vnd.google-apps.folder') continue;

      const newParentDirName = parentDirName ? (parentDirName + '/' + file.name) : file.name;

      const moreFiles = await this.listFilesRecursive(auth, file.id, modifiedTime, newParentDirName);
      files = files.concat(moreFiles);
    }

    return this.removeDuplicates(files);
  }

  listFiles(auth, folderId, modifiedTime, nextPageToken) {
    return retryAsync(10, (resolve, reject) => {

      const drive = google.drive({ version: 'v3', auth });

      let query = '\'' + folderId + '\' in parents and trashed = false';
      if (modifiedTime) {
        query += ' and modifiedTime > \'' + modifiedTime + '\'';
      }

      drive.files.list({
        corpora: 'allDrives',
        q: query,
        pageToken: nextPageToken,
        pageSize: 1000,
        fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, md5Checksum, lastModifyingUser)',
        // fields: 'nextPageToken, files(*)',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        orderBy: 'modifiedTime desc'
      }, async (err, res) => {
        if (err) {
          reject(err);
        }

        if (res.data.nextPageToken) {
          const nextFiles = await this.listFiles(auth, folderId, modifiedTime, res.data.nextPageToken);
          resolve(res.data.files.concat(nextFiles));
        } else {
          res.data.files.forEach(file => {
            file.desiredLocalPath = getDesiredPath(file.name);
            if (file.lastModifyingUser) {
              file.lastAuthor = file.lastModifyingUser.displayName;
              delete file.lastModifyingUser;
            }

            if (file.desiredLocalPath.length > MAX_FILENAME_LENGTH) {
              file.desiredLocalPath = file.desiredLocalPath.substr(0, MAX_FILENAME_LENGTH);
            }

            switch (file.mimeType) {
            case 'application/vnd.google-apps.drawing':
              file.desiredLocalPath += '.svg';
              break;
            case 'application/vnd.google-apps.document':
              file.desiredLocalPath += '.md';
              break;
            }
          });

          resolve(res.data.files);
        }
      });
    });
  }

  download(auth, file, dest) {
    return retryAsync(5, (resolve, reject) => {
      const drive = google.drive({ version: 'v3', auth });

      drive.files.get({
        fileId: file.id,
        alt: 'media',
        supportsAllDrives: true
      }, { responseType: 'stream' }, async (err, res) => {
        if (err) {
          reject(err);
        }

        res.data
          .on('end', () => {
            resolve();
          })
          .on('error', err => {
            reject(err);
          })
          .pipe(dest);
      });
    });
  }

  exportDocument(auth, file, dest) {
    return retryAsync(5, (resolve, reject) => {
      const drive = google.drive({ version: 'v3', auth });

      drive.files.export({
        fileId: file.id,
        mimeType: file.mimeType,
        supportsAllDrives: true
      }, { responseType: 'stream' }, async (err, res) => {
        if (err) {
          reject(err);
        }

        let stream = res.data
          .on('end', () => {})
          .on('error', err => {
            reject(err);
          });

        if (Array.isArray(dest)) {
          dest.forEach(pipe => stream = stream.pipe(pipe));
          stream.on('finish', () => {
            resolve();
          });
        } else {
          stream.pipe(dest);
          dest.on('finish', () => {
            resolve();
          });
        }
      });
    });

  }

}
