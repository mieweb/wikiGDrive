'use strict';

import {google} from 'googleapis';
import {GoogleFile, MimeTypes} from '../storage/GoogleFiles';
import {Logger} from 'winston';

export interface ApiFile extends GoogleFile {
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

export interface ListContext {
  fileIds: string[];
  driveId?: string;
  folderId: string;
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
export class GoogleDriveService {
  private readonly progress: {
    completed: number,
    total: number,
  };

  constructor(private eventBus, private logger: Logger) {
    this.progress = {
      completed: 0,
      total: 0
    };
  }

  async listRootRecursive(auth, context: ListContext, modifiedTime) {
    this.progress.completed = 0;
    this.progress.total = 1;

    this.eventBus.emit('listen:progress', this.progress);

    const files = await this._listFilesRecursive(auth, context, modifiedTime);

    if (!modifiedTime && files.length === 0) {
      this.eventBus.emit('listen:failed', this.progress);
      throw new GoogleDriveServiceError('Empty result for root directory check you auth data or add files');
    }

    this.eventBus.emit('listen:done', this.progress);

    return files;
  }

  private async _listFilesRecursive(auth, context: ListContext, modifiedTime, remotePath = ['']) {
    this.logger.info('Listening folder: ' + (remotePath.join('/') || '/'));
    const files: GoogleFile[] = await this.listFiles(auth, context, modifiedTime);
    this.progress.completed++;
    this.progress.total += files.filter(file => file.mimeType === MimeTypes.FOLDER_MIME).length;

    this.eventBus.emit('listen:progress', this.progress);

    const retVal = [];

    let filesToProcess = [].concat(files);
    retVal.push(...filesToProcess);

    while (filesToProcess.length > 0) {
      filesToProcess = [];

      const promises = [];

      for (const file of files) {
        file.parentId = context.folderId;
        if (file.mimeType !== MimeTypes.FOLDER_MIME) continue;

        const subContext: ListContext = {
          folderId: file.id,
          driveId: context.driveId,
          fileIds: [].concat(context.fileIds)
        };
        const promise = this._listFilesRecursive(auth, subContext, modifiedTime,
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
        .catch(() => {}); /* eslint-disable-line no-useless-catch, @typescript-eslint/no-empty-function */
    }

    if (modifiedTime) {
      const filtered = retVal.filter(dir => {
        const isOldDir = dir.mimeType === MimeTypes.FOLDER_MIME && dir.modifiedTime < modifiedTime;
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

    const params = {
      pageToken: pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: 'newStartPageToken, nextPageToken, changes( file(id, name, mimeType, modifiedTime, size, md5Checksum, lastModifyingUser, parents, version, exportLinks, trashed))',
      includeRemoved: true,
      driveId: driveId ? driveId : undefined
    };

    try {
      const res = await drive.changes.list(params);

      const files = res.data.changes
        .filter(change => !!change.file)
        .map(change => change.file)
        .map(apiFile => {
          const file = <ApiFile><unknown>apiFile;
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

  async listFiles(auth, context: ListContext, modifiedTime, nextPageToken?) {
    const drive = google.drive({ version: 'v3', auth });

    let query = '';

    if (context.folderId) {
      query += '\'' + context.folderId + '\' in parents and trashed = false';
    }
    if (context.fileIds?.length) {
      query += '[' + context.fileIds.map(m => '\'' + m + '\'') + '] in id and trashed = false';
    }
    if (modifiedTime) {
      query += ' and ( modifiedTime > \'' + modifiedTime + '\' or mimeType = \'' + MimeTypes.FOLDER_MIME + '\' )';
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
        const nextFiles = await this.listFiles(auth, context, modifiedTime, res.data.nextPageToken);
        return res.data.files.concat(nextFiles);
      } else {
        for (const apiFile of res.data.files) {
          const file = <GoogleFile><unknown>apiFile;

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
