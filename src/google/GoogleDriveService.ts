'use strict';

// https://developers.google.com/drive/api/v3/reference

import {Logger} from 'winston';
import {Writable} from 'stream';
import {GoogleFile, MimeToExt, MimeTypes, SimpleFile} from '../model/GoogleFile';
import {Drive, Permission} from '../containers/folder_registry/FolderRegistryContainer';
import {FileId} from '../model/model';
import {driveFetch, driveFetchMultipart, driveFetchStream} from './driveFetch';
import {QuotaLimiter} from './QuotaLimiter';
import {HasAccessToken} from './AuthClient';

export interface Changes {
  token: string;
  files: GoogleFile[];
}

export interface ListContext {
  folderId?: string;
  fileId?: string;
  modifiedTime?: string;
  driveId?: string;
  retries?: number;
  // parentName?: string;
}

function apiFileToGoogleFile(apiFile): GoogleFile {
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

  constructor(private logger: Logger, private quotaLimiter: QuotaLimiter) {
  }

  async getStartTrackToken(auth: HasAccessToken, driveId?: string): Promise<string> {
    const params = {
      supportsAllDrives: true,
      driveId: undefined
    };

    if (driveId) {
      params.driveId = driveId;
    }

    const res = await driveFetch(this.quotaLimiter, await auth.getAccessToken(), 'GET', 'https://www.googleapis.com/drive/v3/changes/startPageToken', params);
    return res.startPageToken;
  }

  async subscribeWatch(auth: HasAccessToken, pageToken: string, driveId?: string) {
    try {
      const params = {
        pageToken,
          supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: 'newStartPageToken, nextPageToken, changes( file(id, name, mimeType, modifiedTime, size, md5Checksum, lastModifyingUser, parents, version, exportLinks, trashed), removed)',
        includeRemoved: true,
        driveId: driveId ? driveId : undefined
      };
      return await driveFetch(this.quotaLimiter, await auth.getAccessToken(), 'POST', 'https://www.googleapis.com/drive/v3/changes/watch', params);
    } catch (err) {
      err.message = 'Error watching: ' + err.message;
      throw err;
    }
  }

  async watchChanges(auth: HasAccessToken, pageToken: string, driveId?: string): Promise<Changes> {
    try {
      const params = {
        pageToken: pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: 'newStartPageToken, nextPageToken, changes( file(id, name, mimeType, modifiedTime, size, md5Checksum, lastModifyingUser, parents, version, exportLinks, trashed), removed)',
        includeRemoved: true,
        driveId: driveId ? driveId : undefined
      };
      const res = await driveFetch(this.quotaLimiter, await auth.getAccessToken(), 'GET', 'https://www.googleapis.com/drive/v3/changes', params);

      const files = res.changes
        .filter(change => !!change.file)
        .map(change => {
          if (change.removed) {
            change.file.trashed = true;
          }
          return change.file;
        })
        .map(apiFile => apiFileToGoogleFile(apiFile));

      return {
        token: res.nextPageToken || res.newStartPageToken,
        files: files
      };
    } catch (err) {
      err.message = 'Error watching changes: ' + err.message;
      throw err;
    }
  }

  async listFiles(auth: HasAccessToken, context: ListContext, pageToken?: string) {
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
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, md5Checksum, lastModifyingUser, version, exportLinks, trashed, parents, md5Checksum)',
      // fields: 'nextPageToken, files(*)',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      orderBy: 'modifiedTime desc',
      driveId: context.driveId ? context.driveId : undefined
    };

    try {
      const res = await driveFetch(this.quotaLimiter, await auth.getAccessToken(), 'GET', 'https://www.googleapis.com/drive/v3/files', listParams);

      const apiFiles = [];

      if (res.nextPageToken) {
        const nextFiles = await this.listFiles(auth, context, res.nextPageToken);
        apiFiles.push(...nextFiles);
      }
      apiFiles.push(...res.files);

      return apiFiles.map(apiFile => apiFileToGoogleFile(apiFile));
    } catch (err) {
      err.message = 'Error listening directory ' + context.folderId;
      err.folderId = context.folderId;
      throw err;
    }
  }

  async getFile(auth: HasAccessToken, fileId: FileId): Promise<GoogleFile> {
    try {
      const params = {
        fileId: fileId,
        supportsAllDrives: true,
        // fields: 'id, name, mimeType, modifiedTime, size, md5Checksum, lastModifyingUser, version, exportLinks, trashed, parents'
        fields: '*'
      };
      const res = await driveFetch(this.quotaLimiter, await auth.getAccessToken(), 'GET', `https://www.googleapis.com/drive/v3/files/${fileId}`, params);

      return apiFileToGoogleFile(res);
    } catch (err) {
      err.message = 'Error downloading fileId: ' + fileId + ': ' + err.message;
      throw err;
    }
  }

  async download(auth: HasAccessToken, file: SimpleFile, dest: Writable): Promise<void> {
    try {
      const params = {
        fileId: file.id,
        alt: 'media',
        supportsAllDrives: true
      };
      const res: ReadableStream = await driveFetchStream(this.quotaLimiter, await auth.getAccessToken(), 'GET', `https://www.googleapis.com/drive/v3/files/${file.id}`, params);
      await res.pipeTo(Writable.toWeb(dest));
    } catch (err) {
      err.message = 'Error download file: ' + file.id + ' ' + err.message;
      err.file = file;
      throw err;
    }
  }

  async exportDocument(auth: HasAccessToken, file: SimpleFile, dest: Writable): Promise<void> {
    const ext = MimeToExt[file.mimeType] || '.bin';

    try {
      const params = {
        fileId: file.id,
        mimeType: file.mimeType,
        // includeItemsFromAllDrives: true,
        // supportsAllDrives: true
      };
      const res = await driveFetchStream(this.quotaLimiter, await auth.getAccessToken(), 'GET', `https://www.googleapis.com/drive/v3/files/${file.id}/export`, params);
      await res.pipeTo(Writable.toWeb(dest));
      this.logger.info('Exported document: ' + file.id + ext + ' [' + file.name + ']');
    } catch (err) {
      if (!err.isQuotaError && err?.code != 404) {
        this.logger.error(err.stack ? err.stack : err.message);
      }
      err.message = 'Error export document ' + (err.isQuotaError ? '(quota)' : '') + ': ' + file.id + ' ' + file.name;
      err.file = file;
      throw err;
    }
  }

  async about(auth: HasAccessToken) {
    const params = {
      fields: '*'
    };
    return await driveFetch(this.quotaLimiter, await auth.getAccessToken(), 'GET', 'https://www.googleapis.com/drive/v3/about', params);
  }

  async listDrives(accessToken: string, pageToken?: string): Promise<Drive[]> {
    const listParams = {
      pageSize: 100,
      pageToken: pageToken
    };

    try {
      const res = await driveFetch(this.quotaLimiter, accessToken, 'GET', 'https://www.googleapis.com/drive/v3/drives', listParams);
      const drives = res.drives.map(drive => {
        return {
          id: drive.id,
          name: drive.name,
          kind: drive.kind
        };
      });

      if (res.nextPageToken) {
        const nextDrives = await this.listDrives(accessToken, res.nextPageToken);
        return drives.concat(nextDrives);
      } else {
        return drives;
      }
    } catch (err) {
      err.message = 'Error listening drives: ' + err.message;
      throw err;
    }
  }

  async getDrive(accessToken: string, driveId: FileId): Promise<Drive> {
    const params = {
      driveId
    };

    const url = `https://www.googleapis.com/drive/v3/drives/${driveId.replaceAll('../', '')}`;
    const res = await driveFetch(this.quotaLimiter, accessToken, 'GET', url, params);
    return {
      id: driveId,
      name: res.name,
      kind: res.kind
    };
  }

  async listPermissions(accessToken: string, fileId: string, pageToken?: string): Promise<Permission[]> {
    const params = {
      fileId: fileId,
      supportsAllDrives: true,
      // fields: 'id, name, mimeType, modifiedTime, size, md5Checksum, lastModifyingUser, version, exportLinks, trashed, parents'
      fields: '*',
      pageToken: pageToken
    };
    const res = await driveFetch(this.quotaLimiter, accessToken, 'GET', `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, params);

    const permissions = [];

    if (res.nextPageToken) {
      const nextItems = await this.listPermissions(accessToken, fileId, res.nextPageToken);
      permissions.push(...nextItems);
    }
    permissions.push(...res.permissions);

    return permissions;
  }

  async shareDrive(accessToken: string, fileId: string, email: string): Promise<Permission> {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`;
    return await driveFetch(this.quotaLimiter, accessToken, 'POST', url, {
      sendNotificationEmail: true,
      supportsAllDrives: true
    }, {
      emailAddress: email,
      type: 'user',
      role: 'reader'
    });
  }

  async createDir(accessToken: string, folderId: FileId, name: string) {
    const url = 'https://www.googleapis.com/upload/drive/v3/files';

    const metadata = {
      name,
      'mimeType' : 'application/vnd.google-apps.folder',
      parents: [folderId],
      fields: '*'
    };

    const formData  = new FormData();
    formData.append('Metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' }) );

    return await driveFetchMultipart(this.quotaLimiter, accessToken, 'POST', url, {
      uploadType: 'multipart',
      supportsAllDrives: true
    }, formData);
  }

  async generateIds(accessToken: string, count: number): Promise<FileId[]> {
    const url = 'https://www.googleapis.com/drive/v3/files/generateIds';

    const response = await driveFetch(this.quotaLimiter, accessToken, 'GET', url, {
      count: String(count),
      space: 'drive',
      type: 'files'
    });

    return response.ids;
  }

  async upload(accessToken: string, folderId: FileId, name: string, mimeType: string, buffer: Buffer, id?: FileId) {
    const url = 'https://www.googleapis.com/upload/drive/v3/files';

    let googleMimeType = 'application/octet-stream';
    switch (mimeType) {
      case MimeTypes.IMAGE_SVG:
        // 'mimeType': MimeTypes.DRAWING_MIME, // Error: Bad Request
        googleMimeType = MimeTypes.IMAGE_SVG;
        break;
      case MimeTypes.HTML:
        googleMimeType = MimeTypes.DOCUMENT_MIME;
        break;
    }

    const metadata = {
      name,
      mimeType: googleMimeType,
      parents: [folderId],
      id,
      fields: '*'
    };

    const formData  = new FormData();
    formData.append('Metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' }) );
    formData.append('Media', new Blob([buffer], { type: mimeType }), name);

    try {
      return await driveFetchMultipart(this.quotaLimiter, accessToken, 'POST', url, {
        uploadType: 'multipart',
        supportsAllDrives: true
      }, formData);
    } catch (err) {
      if (409 === parseInt(err.status)) {
        this.logger.error(`Conflict on uploading: ${id} ${name}`);
      }
      throw err;
    }
  }

  async update(accessToken: string, folderId: FileId, name: string, mimeType: string, buffer: Buffer, fileId: FileId) {
    const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}`;

    let googleMimeType = 'application/octet-stream';
    switch (mimeType) {
      case MimeTypes.IMAGE_SVG:
        // 'mimeType': MimeTypes.DRAWING_MIME, // Error: Bad Request
        googleMimeType = MimeTypes.IMAGE_SVG;
        break;
      case MimeTypes.HTML:
        googleMimeType = MimeTypes.DOCUMENT_MIME;
        break;
    }

    const metadata = {
      name,
      mimeType: googleMimeType,
      // parents: [folderId],
      fields: '*'
    };

    const formData  = new FormData();
    formData.append('Metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' }) );
    formData.append('Media', new Blob([buffer], { type: mimeType }), name);

    return await driveFetchMultipart(this.quotaLimiter, accessToken, 'PATCH', url, {
      uploadType: 'multipart',
      supportsAllDrives: true
    }, formData);
  }
}
