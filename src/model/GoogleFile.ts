import {DateISO, FileId} from './model';

export interface SimpleFile {
  id: FileId;
  name: string;
  mimeType: string;
}

export interface DriveData {
  shared?: boolean;
  driveId?: FileId;
}

export interface GoogleFile extends SimpleFile, DriveData {
  parentId?: FileId;
  parents: string[];
  size?: number;
  version: string;
  trashed?: boolean;
  modifiedTime?: DateISO;
  lastAuthor?: string;
  md5Checksum?: string;
}

export const MimeTypes = {
  FOLDER_MIME: 'application/vnd.google-apps.folder',
  DOCUMENT_MIME: 'application/vnd.google-apps.document',
  DRAWING_MIME: 'application/vnd.google-apps.drawing',
  SPREADSHEET_MIME: 'application/vnd.google-apps.spreadsheet',
  FORM_MIME: 'application/vnd.google-apps.form',
  PRESENTATION_MIME: 'application/vnd.google-apps.presentation',
  APPS_SCRIPT: 'application/vnd.google-apps.script',
  MARKDOWN: 'text/x-markdown',
  SHORTCUT: 'application/vnd.google-apps.shortcut',
  IMAGE_SVG: 'image/svg+xml',
  HTML: 'text/html'
};
export const MimeToExt = {
  'image/svg+xml': '.svg',
  'application/vnd.oasis.opendocument.text': '.odt'
};
