'use strict';

import {google} from 'googleapis';
import {File, FilesStructure} from '../storage/FilesStructure';

export interface ApiFile extends File {
  parents: string[];
}

export interface Changes {
  token: string;
  files: ApiFile[];
}

function removeDuplicates(files) {
  const retVal = [];

  for (const file of files) {
    if (retVal.find(entry => entry.id === file.id)) {
      continue;
    }
    retVal.push(file);
  }

  return retVal;
}

interface GoogleDriveServiceErrorParams {
  origError: Error;
  isQuotaError: boolean;

  file?: string;
  dest?: string;
  folderId?: string;
}

export class GoogleDriveServiceError extends Error {
  private file: any;
  private dest: any;
  private folderId: string;
  private isQuotaError: boolean;
  private origError: Error;

  constructor(msg, params?: GoogleDriveServiceErrorParams) {
    super(msg);
    if (params) {
      this.origError = params.origError;
      this.isQuotaError = params.isQuotaError;

      this.file = params.file;
      this.dest = params.dest;
      this.folderId = params.folderId;
    }
  }
}

export function urlToFolderId(url) {
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


export class GoogleDriveService {
  constructor() {
  }

  async listRootRecursive(auth, context, modifiedTime) {
    const files = await this._listFilesRecursive(auth, context, modifiedTime);

    if (!modifiedTime && files.length === 0) {
      throw new GoogleDriveServiceError('Empty result for root directory check you auth data or add files');
    }

    return files;
  }

  async _listFilesRecursive(auth, context, modifiedTime, remotePath = ['']) {
    console.log('Listening folder:', remotePath.join('/') || '/');
    let files: File[] = await this._listFiles(auth, context, modifiedTime);

    const retVal = [];

    let filesToProcess = [].concat(files);
    retVal.push(...filesToProcess);

    while (filesToProcess.length > 0) {
      filesToProcess = [];

      const promises = [];

      for (const file of files) {
        file.parentId = context.folderId;
        if (file.mimeType !== FilesStructure.FOLDER_MIME) continue;

        const promise = this._listFilesRecursive(auth, Object.assign({}, context, { folderId: file.id }), modifiedTime,
            remotePath.concat(file.name));
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

  async getStartTrackToken(auth, driveId) {
    const drive = google.drive({ version: 'v3', auth });

    const params = {
      supportsAllDrives: true,
      driveId: undefined
    }

    if (driveId) {
      params.driveId = driveId;
    }

    const res = await drive.changes.getStartPageToken(params);
    return res.data.startPageToken;
  }

  async watchChanges(auth, pageToken, driveId): Promise<Changes> {
    const drive = google.drive({ version: 'v3', auth });

    const params = {
      pageToken: pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: 'newStartPageToken, nextPageToken, changes( file(id, name, mimeType, modifiedTime, size, md5Checksum, lastModifyingUser, parents, version, exportLinks, trashed))',
      driveId: undefined
    };

    if (driveId) {
      params.driveId = driveId;
    }

    try {
      const res = await drive.changes.list(params);

      const files = res.data.changes
        .filter(change => !!change.file)
        .map(change => change.file)
        .map(apiFile => {
          const file = <ApiFile>apiFile;
          if (apiFile.parents && apiFile.parents.length > 0) {
            file.parentId = apiFile.parents[0];
          }

          if (apiFile.lastModifyingUser) {
            file.lastAuthor = apiFile.lastModifyingUser.displayName;
            delete apiFile.lastModifyingUser;
          }

          return file;
        });

      return {
        token: res.data.nextPageToken || res.data.newStartPageToken,
        files: files
      };
    } catch (err) {
      throw new GoogleDriveServiceError('Error watching changes', {
        origError: err,
        isQuotaError: err.isQuotaError
      });
    }
  }

  async _listFiles(auth, context, modifiedTime, nextPageToken?) {
    const drive = google.drive({ version: 'v3', auth });

    let query = '\'' + context.folderId + '\' in parents and trashed = false';
    if (modifiedTime) {
      query += ' and ( modifiedTime > \'' + modifiedTime + '\' or mimeType = \'' + FilesStructure.FOLDER_MIME + '\' )';
    }

    const listParams = {
      corpora: context.driveId ? 'drive' : 'allDrives',
      q: query,
      pageToken: nextPageToken,
      pageSize: 1000,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, md5Checksum, lastModifyingUser, version, exportLinks, trashed)',
      // fields: 'nextPageToken, files(*)',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      orderBy: 'modifiedTime desc',
      driveId: undefined
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
        for (const apiFile of res.data.files) {
          const file = <File>apiFile;

          if (apiFile.lastModifyingUser) {
            file.lastAuthor = apiFile.lastModifyingUser.displayName;
            delete apiFile.lastModifyingUser;
          }
        }

        return res.data.files;
      }
    } catch (err) {
      throw new GoogleDriveServiceError('Error listening directory ' + context.folderId, {
        origError: err,
        folderId: context.folderId,
        isQuotaError: err.isQuotaError
      });
    }
  }

  async download(auth, file, dest) {
    const drive = google.drive({ version: 'v3', auth });

    try {
      const res = <any>await drive.files.get({
        fileId: file.id,
        alt: 'media',
        // includeItemsFromAllDrives: true,
        supportsAllDrives: true
      }, { responseType: 'stream' });

      return new Promise((resolve, reject) => {
        res.data
            .on('end', () => {
              resolve();
            })
            .on('error', err => {
              reject(err);
            })
            .pipe(dest);
      });
    } catch (err) {
      throw new GoogleDriveServiceError('Error download file: ' + file.id, {
        origError: err,
        file, dest, isQuotaError: err.isQuotaError
      });
    }
  }

  async exportDocument(auth, file, dest) {
    const drive = google.drive({ version: 'v3', auth });

    try {
      const res = <any>await drive.files.export({
        fileId: file.id,
        mimeType: file.mimeType,
        // includeItemsFromAllDrives: true,
        // supportsAllDrives: true
      }, { responseType: 'stream' });

      await new Promise((resolve, reject) => {
        let stream = res.data
          .on('end', () => {})
          .on('error', err => {
            reject(err);
          });

        if (Array.isArray(dest)) {
          dest.forEach(pipe => stream = stream.pipe(pipe));
          stream.on('finish', () => {
            console.log('Exported document: ' + file.id + '.html [' + file.localPath + ']');
            resolve();
          });
        } else {
          stream.pipe(dest);
          dest.on('finish', () => {
            console.log('Exported document: ' + file.id + '.html [' + file.localPath + ']');
            resolve();
          });
        }
      });
    } catch (err) {
      if (!err.isQuotaError && err?.code != 404) {
        console.error(err);
      }
      throw new GoogleDriveServiceError('Error export document ' + (err.isQuotaError ? '(quota)' : '') + ': ' + file.id, {
        origError: err,
        file, dest, isQuotaError: err.isQuotaError
      });
    }
  }

  async listDrives(auth, nextPageToken?) {
    const drive = google.drive({ version: 'v3', auth });

    const listParams = {
      pageSize: 100,
      pageToken: nextPageToken
    }

    try {
      const res = await drive.drives.list(listParams);
      const drives = res.data.drives.map(drive => {
        return {
          id: drive.id,
          name: drive.name,
          kind: drive.kind
        }
      });

      if (res.data.nextPageToken) {
        const nextDrives = await this.listDrives(auth, res.data.nextPageToken);
        return drives.concat(nextDrives);
      } else {
        return drives;
      }
    } catch (err) {
      throw new GoogleDriveServiceError('Error listening drives', {
        origError: err,
        isQuotaError: err.isQuotaError,
      });
    }

  }

}
