'use strict';

import {google} from 'googleapis';
import slugify from 'slugify';

export class GoogleDriveService {

  urlToFolderId(url) {
    if (url.match(/drive.google.com\/drive.*folders\//)) {
      let id = url.substr(url.indexOf('/folders/') + '/folders/'.length);
      if (id.indexOf('/') > 0) {
        id = id.substr(0, id.indexOf('/'));
      }
      if (id.indexOf('?') > 0) {
        id = id.substr(0, id.indexOf('?'));
      }
      return id;
    }

    if (url.startsWith('https://drive.google.com/open?id=')) {
      let id = url.substr('https://drive.google.com/open?id='.length);
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
      return id;
    }

    return false;
  }

  async listFilesRecursive(auth, folderId, modifiedTime, parentDirName) {
    let files = await this.listFiles(auth, folderId, modifiedTime);

    if (parentDirName) {
      files.forEach(file => {
        file.localPath = parentDirName + '/' + file.localPath;
        if (file.htmlPath) {
          file.htmlPath = slugify(parentDirName, { replacement: '-', lower: true }) + '/' + file.htmlPath;
        }
      });
    }

    for (let fileNo = 0; fileNo < files.length; fileNo++) {
      const file = files[fileNo];
      if (file.mimeType !== 'application/vnd.google-apps.folder') continue;

      const moreFiles = await this.listFilesRecursive(auth, file.id, modifiedTime, file.name);
      files = files.concat(moreFiles);
    }

    return files;
  }

  listFiles(auth, folderId, modifiedTime, nextPageToken) {
    return new Promise((resolve, reject) => {

      const drive = google.drive({version: 'v3', auth});

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
            file.localPath = file.name;
            if (file.lastModifyingUser) {
              file.lastAuthor = file.lastModifyingUser.displayName
              delete file.lastModifyingUser;
            }

            switch (file.mimeType) {
              case 'application/vnd.google-apps.drawing':
                file.localPath += '.svg';
                break;
              case 'application/vnd.google-apps.document':
                file.htmlPath = slugify(file.name, { replacement: '-', lower: true }) + '.html';
                file.localPath += '.md';
                break;
            }
          });

          resolve(res.data.files);
        }

      });

    })
  }

  download(auth, file, dest) {
    return new Promise((resolve, reject) => {
      const drive = google.drive({version: 'v3', auth});

      drive.files.get({
        fileId: file.id,
        alt: 'media',
        supportsAllDrives: true
      }, {responseType: 'stream'}, async (err, res) => {
        if (err) {
          reject(err);
        }

        res.data
          .on('end', () => {
            resolve()
          })
          .on('error', err => {
              reject(err);
            })
          .pipe(dest);
      })
    });

  }

  exportDocument(auth, file, dest) {
    return new Promise((resolve, reject) => {
      const drive = google.drive({version: 'v3', auth});

      drive.files.export({
        fileId: file.id,
        mimeType: file.mimeType,
        supportsAllDrives: true
      }, {responseType: 'stream'}, async (err, res) => {
        if (err) {
          reject(err);
        }

        let stream = res.data
          .on('end', () => {
            resolve()
          })
          .on('error', err => {
            reject(err);
          });

        if (Array.isArray(dest)) {
          dest.forEach(pipe => stream = stream.pipe(pipe))
        } else {
          stream.pipe(dest);
        }

      })
    });

  }

}
