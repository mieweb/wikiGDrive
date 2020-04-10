'use strict';

import { google } from 'googleapis';
import slugify from 'slugify';
import { FilesStructure } from '../storage/FilesStructure';
import { retryAsync } from '../utils/retryAsync';

const MAX_FILENAME_LENGTH = 100;

export function getDesiredPath(name) {
  name = name.replace(/[&]+/g, ' and ');
  name = name.replace(/[/:()]+/g, ' ');
  name = name.trim();
  name = slugify(name, { replacement: '-', lower: true });
  return name;
}

function removeDuplicates(files) {
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

  async listFilesRecursive(auth, context) {
    return await this._listFilesRecursive(auth, context);
  }

  async _listFilesRecursive(auth, context, modifiedTime, parentDirName) {
    console.log('Listening folder:', parentDirName || '/');
    let files = await this._listFiles(auth, context, modifiedTime);

    if (parentDirName && !this.params['flat-folder-structure']) {
      files.forEach(file => {
        const slugifiedParent = parentDirName
          .split('/')
          .map(part => getDesiredPath(part))
          .join('/');

        file.desiredLocalPath = slugifiedParent + '/' + file.desiredLocalPath;
      });
    }

    const retVal = [];

    let filesToProcess = [].concat(files);
    retVal.push(...filesToProcess);

    while (filesToProcess.length > 0) {
      filesToProcess = [];

      const promises = [];

      for (let fileNo = 0; fileNo < files.length; fileNo++) {

        const file = files[fileNo];
        if (file.mimeType !== 'application/vnd.google-apps.folder') continue;

        const newParentDirName = parentDirName ? (parentDirName + '/' + file.name) : file.name;

        promises.push(this._listFilesRecursive(auth, Object.assign({}, context, { folderId: file.id }), modifiedTime, newParentDirName));

        // const moreFiles = await
        // filesToProcess = filesToProcess.concat(moreFiles);
      }

      await Promise.all(promises).then(list => {

/*        if (list.length > 0) {
          console.log('llll', promises.length, list);
          process.exit(1);
        }*/

        for (const moreFiles of list) {
          // filesToProcess = filesToProcess.concat(moreFiles);
          retVal.push(...moreFiles);
        }
      });
    }

    if (modifiedTime) {
      const filtered = retVal.filter(dir => {
        const isOldDir = dir.mimeType === FilesStructure.FOLDER_MIME && dir.modifiedTime < modifiedTime;
        return !isOldDir;
      });

      return removeDuplicates(filtered);
    }

    // console.log('retVal11', retVal.length);

    return removeDuplicates(retVal);
  }

  getStartTrackToken(auth) {
    return new Promise((resolve, reject) => {
      const drive = google.drive({ version: 'v3', auth });

      drive.changes.getStartPageToken({}, function (err, res) {
        if (err) {
          return reject(err);
        }
        resolve(res.data.startPageToken);
      });
    });
  }

  watchChanges(auth, pageToken) {
    return new Promise(((resolve, reject) => {
      const drive = google.drive({ version: 'v3', auth });

      drive.changes.list({
        pageToken: pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: 'newStartPageToken, changes( file(id, name, mimeType, modifiedTime, size, md5Checksum, lastModifyingUser, parents))'
      }, (err, res) => {
        if (err) {
          console.error(err);
          return reject(err);
        } else {
          const files = res.data.changes
            .map(change => change.file)
            .map((file) => {
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

              return file;
            });

          resolve({
            token: res.data.newStartPageToken,
            files: files
          });
        }
      });
    }));
  }

  _listFiles(auth, context, modifiedTime, nextPageToken) {
    return retryAsync(10, (resolve, reject) => {

      const drive = google.drive({ version: 'v3', auth });

      let query = '\'' + context.folderId + '\' in parents and trashed = false';
      if (modifiedTime) {
        query += ' and ( modifiedTime > \'' + modifiedTime + '\' or mimeType = \'application/vnd.google-apps.folder\' )';
      }

      const listParams = {
        corpora: 'allDrives',
        q: query,
        pageToken: nextPageToken,
        pageSize: 1000,
        fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, md5Checksum, lastModifyingUser)',
        // fields: 'nextPageToken, files(*)',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        orderBy: 'modifiedTime desc'
      };

      if (context.driveId) {
        listParams.driveId = context.driveId;
      }


      drive.files.list(listParams, async (err, res) => {
        if (err) {
          return reject(err);
        }

        if (res.data.nextPageToken) {
          const nextFiles = await this._listFiles(auth, context, modifiedTime, res.data.nextPageToken);
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
        includeItemsFromAllDrives: true,
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
        includeItemsFromAllDrives: true,
        supportsAllDrives: true
      }, { responseType: 'stream' }, async (err, res) => {
        if (err) {
          reject(err);
          console.error(err);
          console.log('res', res);
          return;
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
