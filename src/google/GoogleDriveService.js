'use strict';

import { google } from 'googleapis';
import slugify from 'slugify';
import { FilesStructure } from '../storage/FilesStructure';

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

export class GoogleDriveServiceError extends Error {
  constructor(msg, params) {
    super(msg);
    if (params) {
      this.file = params.file;
      this.dest = params.dest;
      this.folderId = params.folderId;
      this.isQuotaError = params.isQuotaError;
    }
  }
}

export class GoogleDriveService {
  constructor(flat_folder_structure) {
    this.flat_folder_structure = flat_folder_structure;
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

  async listRootRecursive(auth, context, modifiedTime) {
    const files = await this._listFilesRecursive(auth, context, modifiedTime);

    if (!modifiedTime && files.length === 0) {
      throw new GoogleDriveServiceError('Empty result for root directory check you auth data or add files');
    }

    return files;
  }

   async _listFilesRecursive(auth, context, modifiedTime, parentDirName) {
    console.log('Listening folder:', parentDirName || '/');
    let files = await this._listFiles(auth, context, modifiedTime);

    if (parentDirName && !this.flat_folder_structure) {
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

        const promise = this._listFilesRecursive(auth, Object.assign({}, context, { folderId: file.id }), modifiedTime, newParentDirName);
        promises.push(promise);

        promise.catch(() => {
          filesToProcess.push(file);
        });
      }

      await Promise.all(promises)
        .then(list => {
          for (const moreFiles of list) {
            retVal.push(...moreFiles);
          }
        })
        .catch(() => {}); /* eslint-disable-line no-useless-catch */
    }

    if (modifiedTime) {
      const filtered = retVal.filter(dir => {
        const isOldDir = dir.mimeType === FilesStructure.FOLDER_MIME && dir.modifiedTime < modifiedTime;
        return !isOldDir;
      });

      return removeDuplicates(filtered);
    }

    return removeDuplicates(retVal);
  }

  async getStartTrackToken(auth) {
    const drive = google.drive({ version: 'v3', auth });
    const res = await drive.changes.getStartPageToken({});
    return res.data.startPageToken;
  }

  watchChanges(auth, pageToken, driveId) {
    return new Promise(async (resolve, reject) => { /* eslint-disable-line no-async-promise-executor */
      const drive = google.drive({ version: 'v3', auth });

      const params = {
        pageToken: pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        includeCorpusRemovals: true,
        fields: 'newStartPageToken, changes( file(id, name, mimeType, modifiedTime, size, md5Checksum, lastModifyingUser, parents, version))'
      };

      if (driveId) {
        params.drives = [ driveId ];
      }

      try {
        const res = await drive.changes.list(params);

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
      } catch (err) {
        reject(new GoogleDriveServiceError('Error watching changes', {
          isQuotaError: err.isQuotaError
        }));
      }
    });
  }

  async _listFiles(auth, context, modifiedTime, nextPageToken) {
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
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, md5Checksum, lastModifyingUser, version)',
      // fields: 'nextPageToken, files(*)',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      orderBy: 'modifiedTime desc'
    };

    if (context.driveId) {
      listParams.driveId = context.driveId;
    }

    try {
      const res = await drive.files.list(listParams);
      if (res.data.nextPageToken) {
        const nextFiles = await this._listFiles(auth, context, modifiedTime, res.data.nextPageToken);
        return res.data.files.concat(nextFiles);
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

        return res.data.files;
      }
    } catch (err) {
      throw new GoogleDriveServiceError('Error listening directory ' + context.folderId, {
        folderId: context.folderId,
        isQuotaError: err.isQuotaError
      });
    }
  }

  download(auth, file, dest) {
    const drive = google.drive({ version: 'v3', auth });

    return new Promise(async (resolve, reject) => { /* eslint-disable-line no-async-promise-executor */
      try {
        const res = await drive.files.get({
          fileId: file.id,
          alt: 'media',
          includeItemsFromAllDrives: true,
          supportsAllDrives: true
        }, { responseType: 'stream' });

        res.data
          .on('end', () => {
            resolve();
          })
          .on('error', err => {
            reject(err);
          })
          .pipe(dest);
      } catch (err) {
        reject(throw new GoogleDriveServiceError('Error download file: ' + file.id, {
          file, dest, isQuotaError: err.isQuotaError
        }));
      }
    });
  }

  exportDocument(auth, file, dest) {
    const drive = google.drive({ version: 'v3', auth });

    return new Promise(async (resolve, reject) => { /* eslint-disable-line no-async-promise-executor */
      try {
        const res = await drive.files.export({
          fileId: file.id,
          mimeType: file.mimeType,
          includeItemsFromAllDrives: true,
          supportsAllDrives: true
        }, { responseType: 'stream' });

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
      } catch (err) {
        reject(throw new GoogleDriveServiceError('Error export document: ' + file.id, {
          file, dest, isQuotaError: err.isQuotaError
        }));
        reject(err);
      }

    });
  }
}
