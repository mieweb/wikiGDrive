'use strict';

import {google} from 'googleapis';
import {Logger} from 'winston';
import {drive_v3} from 'googleapis/build/src/apis/drive/v3';
import {OAuth2Client} from 'google-auth-library/build/src/auth/oauth2client';
import {Writable} from 'stream';
import {GoogleFile, MimeToExt, MimeTypes, SimpleFile} from '../model/GoogleFile';
import Schema$Permission = drive_v3.Schema$Permission;
import {Drive} from '../containers/folder_registry/FolderRegistryContainer';
import {FileId} from '../model/model';

export interface Changes {
  token: string;
  files: GoogleFile[];
}

interface GoogleDriveServiceErrorParams {
  origError: Error;
  isQuotaError: boolean;

  code?: number;
  file?: SimpleFile;
  dest?: Writable;
  folderId?: string;
}

export interface ListContext {
  folderId?: string;
  fileId?: string;
  modifiedTime?: string;
  driveId?: string;
  retries?: number;
  // parentName?: string;
}

export class GoogleDriveServiceError extends Error {
  private file: SimpleFile;
  private dest: Writable;
  private folderId: string;
  private isQuotaError: boolean;
  private origError: Error;
  private code: number;

  constructor(msg, params?: GoogleDriveServiceErrorParams) {
    super(msg);
    if (params) {
      this.code = params.code;
      this.origError = params.origError;
      this.isQuotaError = params.isQuotaError;

      this.file = params.file;
      this.dest = params.dest;
      this.folderId = params.folderId;
    }
  }
}

function apiFileToGoogleFile(apiFile: drive_v3.Schema$File): GoogleFile {
  const googleFile: GoogleFile = <GoogleFile>Object.assign({}, apiFile, {
    parentId: (apiFile.parents && apiFile.parents.length > 0) ? apiFile.parents[0] : undefined,
    size: apiFile.size ? +apiFile.size : undefined
  });

  if (googleFile['lastModifyingUser']) {
    googleFile.lastAuthor = apiFile['lastModifyingUser'].emailAddress
      ? `${apiFile['lastModifyingUser'].displayName} <${apiFile['lastModifyingUser'].emailAddress}>`
      : apiFile['lastModifyingUser'].displayName;
  }

  return googleFile;
}

export class GoogleDriveService {

  constructor(private logger: Logger) {
  }

  async getStartTrackToken(auth: OAuth2Client, driveId?: string): Promise<string> {
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

  async subscribeWatch(auth: OAuth2Client, pageToken: string, driveId?: string) {
    const drive = google.drive({ version: 'v3', auth });

    try {
      const res = await drive.changes.watch({
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: 'newStartPageToken, nextPageToken, changes( file(id, name, mimeType, modifiedTime, size, md5Checksum, lastModifyingUser, parents, version, exportLinks, trashed), removed)',
        includeRemoved: true,
        driveId: driveId ? driveId : undefined
      });

      console.log(res);
      return res;
    } catch (err) {
      throw new GoogleDriveServiceError('Error watching', {
        origError: err,
        isQuotaError: err.isQuotaError
      });
    }
  }

  async watchChanges(auth: OAuth2Client, pageToken: string, driveId?: string): Promise<Changes> {
    const drive = google.drive({ version: 'v3', auth });

    try {
      const res = await drive.changes.list({
        pageToken: pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: 'newStartPageToken, nextPageToken, changes( file(id, name, mimeType, modifiedTime, size, md5Checksum, lastModifyingUser, parents, version, exportLinks, trashed), removed)',
        includeRemoved: true,
        driveId: driveId ? driveId : undefined
      });

      const files = res.data.changes
        .filter(change => !!change.file)
        .map(change => {
          if (change.removed) {
            change.file.trashed = true;
          }
          return change.file;
        })
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

  async listFiles(auth: OAuth2Client, context: ListContext, pageToken?: string) {
    const drive = google.drive({ version: 'v3', auth });

    let query = '';

    if (context.folderId) {
      query += ' \'' + context.folderId + '\' in parents and trashed = false';
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
      pageToken: pageToken,
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
      throw new GoogleDriveServiceError('Error listening directory ' + context.folderId, {
        origError: err,
        folderId: context.folderId,
        isQuotaError: err.isQuotaError
      });
    }
  }

  async listPermissions(auth: OAuth2Client, fileId: string, pageToken?: string) {
    const drive = google.drive({ version: 'v3', auth });

    try {
      const res = await drive.permissions.list({
        fileId: fileId,
        supportsAllDrives: true,
        // fields: 'id, name, mimeType, modifiedTime, size, md5Checksum, lastModifyingUser, version, exportLinks, trashed, parents'
        fields: '*',
        pageToken: pageToken
      });

      const permissions = [];

      if (res.data.nextPageToken) {
        const nextItems = await this.listPermissions(auth, fileId, res.data.nextPageToken);
        permissions.push(...nextItems);
      }
      permissions.push(...res.data.permissions);

      return permissions;
    } catch (err) {
      throw new GoogleDriveServiceError('Error download fileId: ' + fileId, {
        origError: err, isQuotaError: err.isQuotaError
      });
    }
  }

  async getFile(auth: OAuth2Client, fileId: FileId) {
    const drive = google.drive({ version: 'v3', auth });

    try {
      const res = await drive.files.get({
        fileId: fileId,
        supportsAllDrives: true,
        // fields: 'id, name, mimeType, modifiedTime, size, md5Checksum, lastModifyingUser, version, exportLinks, trashed, parents'
        fields: '*'
      });

      return apiFileToGoogleFile(res.data);
    } catch (err) {
      throw new GoogleDriveServiceError('Error download fileId: ' + fileId, {
        origError: err, isQuotaError: err.isQuotaError
      });
    }
  }

  async download(auth: OAuth2Client, file: SimpleFile, dest: Writable) {
    const drive = google.drive({ version: 'v3', auth });

    try {
      const res = await drive.files.get({
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
      throw new GoogleDriveServiceError('Error download file: ' + file.id + ' ' + err.message, {
        origError: err,
        file, dest, isQuotaError: err.isQuotaError
      });
    }
  }

  async exportDocument(auth: OAuth2Client, file: SimpleFile, dest: Writable) {
    const drive = google.drive({ version: 'v3', auth });

    const ext = MimeToExt[file.mimeType] || '.bin';

    try {
      const res = await drive.files.export({
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
            this.logger.info('Exported document: ' + file.id + ext + ' [' + file.name + ']');
            resolve(file);
          });
        } else {
          stream.pipe(dest);
          dest.on('finish', () => {
            this.logger.info('Exported document: ' + file.id + ext + ' [' + file.name + ']');
            resolve(file);
          });
        }
      });
    } catch (err) {
      if (!err.isQuotaError && err?.code != 404) {
        this.logger.error(err);
      }
      throw new GoogleDriveServiceError('Error export document ' + (err.isQuotaError ? '(quota)' : '') + ': ' + file.id + ' ' + file.name, {
        origError: err,
        file, dest, isQuotaError: err.isQuotaError
      });
    }
  }

  async about(auth: OAuth2Client) {
    try {
      const drive = google.drive({ version: 'v3', auth });
      const res = await drive.about.get({
        fields: '*'
      });
      return res.data;
    } catch (err) {
      throw new GoogleDriveServiceError('Error about: ' + err.response.statusText, {
        origError: err,
        isQuotaError: err.isQuotaError,
      });
    }
  }

  async listDrives(auth: OAuth2Client, pageToken?: string): Promise<Drive[]> {
    const drive = google.drive({ version: 'v3', auth });

    const listParams = {
      pageSize: 100,
      pageToken: pageToken
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
      throw new GoogleDriveServiceError('Error listening drives: ' + err.response.statusText, {
        origError: err,
        isQuotaError: err.isQuotaError,
      });
    }
  }

  async getDrive(auth: OAuth2Client, driveId: FileId): Promise<Drive> {
    try {
      const drive = google.drive({ version: 'v3', auth });
      const res = await drive.drives.get({ driveId });
      return {
        id: driveId,
        name: res.data.name,
        kind: res.data.kind
      };
    } catch (err) {
      throw new GoogleDriveServiceError('Error getting drive: ' + err.response?.statusText, {
        code: err.response.status,
        origError: err,
        isQuotaError: err.isQuotaError,
      });
    }
  }

  async shareDrive(auth: OAuth2Client, driveId: string, email: string) {
    try {
      const permissions: Schema$Permission = {
        type: 'user',
        role: 'reader',
        emailAddress: email
      };

      const drive = google.drive({ version: 'v3', auth });
      const res = await drive.permissions.create({
        requestBody: permissions,
        fileId: driveId,
        fields: 'id',
      });
      return res.data;
    } catch (err) {
      console.error(err);
      throw new GoogleDriveServiceError('Error getting drive: ' + err.response.statusText, {
        origError: err,
        isQuotaError: err.isQuotaError,
      });
    }
  }
}
