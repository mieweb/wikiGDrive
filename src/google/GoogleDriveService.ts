'use strict';

import {google} from 'googleapis';
import {GoogleFile, MimeTypes} from '../storage/GoogleFiles';
import {Logger} from 'winston';
import {drive_v3} from 'googleapis/build/src/apis/drive/v3';

export interface Changes {
  token: string;
  files: GoogleFile[];
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

export interface ListContext {
  parentId?: string;
  fileId?: string;
  modifiedTime?: string;
  driveId?: string;
  retries?: number;
  parentName?: string;
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

function apiFileToGoogleFile(apiFile: drive_v3.Schema$File): GoogleFile {
  const googleFile: GoogleFile = <any>Object.assign({}, apiFile, {
    parentId: (apiFile.parents && apiFile.parents.length > 0) ? apiFile.parents[0] : undefined,
    size: apiFile.size ? +apiFile.size : undefined
  });

  if (googleFile['lastModifyingUser']) {
    googleFile.lastAuthor = apiFile['lastModifyingUser'].displayName;
  }

  return googleFile;
}

export class GoogleDriveService {

  constructor(private eventBus, private logger: Logger) {
  }

  async listRootRecursive(auth, context: ListContext) {

    const files = await this._listFilesRecursive(auth, context);

    if (!context.modifiedTime && files.length === 0) {
      throw new GoogleDriveServiceError('Empty result for root directory check you auth data or add files');
    }

    return files;
  }

  private async _listFilesRecursive(auth, context: ListContext, remotePath = ['']) {
    this.logger.info('Listening folder: ' + (remotePath.join('/') || '/'));
    const files: GoogleFile[] = await this.listFiles(auth, context);

    const retVal = [];

    let filesToProcess = [].concat(files);
    retVal.push(...filesToProcess);

    while (filesToProcess.length > 0) {
      filesToProcess = [];

      const promises = [];

      for (const file of files) {
        file.parentId = context.parentId;
        if (file.mimeType !== MimeTypes.FOLDER_MIME) continue;

        const subContext: ListContext = {
          parentId: file.id,
          driveId: context.driveId,
          fileId: context.fileId
        };
        const promise = this._listFilesRecursive(auth, subContext, remotePath.concat(file.name));
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
        .catch(() => {}); /* eslint-disable-line no-useless-catch, @typescript-eslint/no-empty-function */
    }

    if (context.modifiedTime) {
      const filtered = retVal.filter(dir => {
        const isOldDir = dir.mimeType === MimeTypes.FOLDER_MIME && dir.modifiedTime < context.modifiedTime;
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
    };

    if (driveId) {
      params.driveId = driveId;
    }

    const res = await drive.changes.getStartPageToken(params);
    return res.data.startPageToken;
  }

  async watchChanges(auth, pageToken, driveId): Promise<Changes> {
    const drive = google.drive({ version: 'v3', auth });

    try {
      const res = await drive.changes.list({
        pageToken: pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: 'newStartPageToken, nextPageToken, changes( file(id, name, mimeType, modifiedTime, size, md5Checksum, lastModifyingUser, parents, version, exportLinks, trashed))',
        includeRemoved: true,
        driveId: driveId ? driveId : undefined
      });

      const files = res.data.changes
        .filter(change => !!change.file)
        .map(change => change.file)
        .map(apiFile => apiFileToGoogleFile(apiFile));

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

  async listFiles(auth, context: ListContext, nextPageToken?) {
    const drive = google.drive({ version: 'v3', auth });

    let query = '';

    if (context.parentId) {
      query += ' \'' + context.parentId + '\' in parents and trashed = false';
    }
    if (context.fileId) {
      query += ' \'' + context.fileId + '\' = id and trashed = false';
    }
    if (context.modifiedTime) {
      query += ' and ( modifiedTime > \'' + context.modifiedTime + '\' or mimeType = \'' + MimeTypes.FOLDER_MIME + '\' )';
    }

    const listParams = {
      corpora: context.driveId ? 'drive' : 'allDrives',
      q: query,
      pageToken: nextPageToken,
      pageSize: 1000,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, md5Checksum, lastModifyingUser, version, exportLinks, trashed, parents)',
      // fields: 'nextPageToken, files(*)',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      orderBy: 'modifiedTime desc',
      driveId: context.driveId ? context.driveId : undefined
    };

    try {
      const res = await drive.files.list(listParams);

      const apiFiles = [];

      if (res.data.nextPageToken) {
        const nextFiles = await this.listFiles(auth, context, res.data.nextPageToken);
        apiFiles.push(...nextFiles);
      }
      apiFiles.push(...res.data.files);

      return apiFiles.map(apiFile => apiFileToGoogleFile(apiFile));
    } catch (err) {
      throw new GoogleDriveServiceError('Error listening directory ' + context.parentId, {
        origError: err,
        folderId: context.parentId,
        isQuotaError: err.isQuotaError
      });
    }
  }

  async getFile(auth, fileId) {
    const drive = google.drive({ version: 'v3', auth });

    try {
      const res = await drive.files.get({
        fileId: fileId,
        supportsAllDrives: true,
        fields: 'id, name, mimeType, modifiedTime, size, md5Checksum, lastModifyingUser, version, exportLinks, trashed, parents'
      });

      return apiFileToGoogleFile(res.data);
    } catch (err) {
      throw new GoogleDriveServiceError('Error download fileId: ' + fileId, {
        origError: err, isQuotaError: err.isQuotaError
      });
    }
  }

  async download(auth, file, dest) {
    const drive = google.drive({ version: 'v3', auth });

    try {
      const res = <any>await drive.files.get({
        fileId: file.id,
        alt: 'media',
        supportsAllDrives: true
      }, { responseType: 'stream' });

      return new Promise<void>((resolve, reject) => {
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

    const ext = file.mimeType === 'image/svg+xml' ? '.svg' : '.zip';

    try {
      const res = <any>await drive.files.export({
        fileId: file.id,
        mimeType: file.mimeType,
        // includeItemsFromAllDrives: true,
        // supportsAllDrives: true
      }, { responseType: 'stream' });

      return await new Promise((resolve, reject) => {
        let stream = res.data
          .on('error', err => {
            reject(err);
          });

        if (Array.isArray(dest)) {
          dest.forEach(pipe => stream = stream.pipe(pipe));
          stream.on('finish', () => {
            this.logger.info('Exported document: ' + file.id + ext + ' [' + file.localPath + ']');
            resolve(file);
          });
        } else {
          stream.pipe(dest);
          dest.on('finish', () => {
            this.logger.info('Exported document: ' + file.id + ext + ' [' + file.localPath + ']');
            resolve(file);
          });
        }
      });
    } catch (err) {
      if (!err.isQuotaError && err?.code != 404) {
        this.logger.error(err);
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
    };

    try {
      const res = await drive.drives.list(listParams);
      const drives = res.data.drives.map(drive => {
        return {
          id: drive.id,
          name: drive.name,
          kind: drive.kind
        };
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
