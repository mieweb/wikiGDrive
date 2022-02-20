import {DateISO, FileId} from './model';

export interface SimpleFile {
    id: FileId;
    name: string,
    mimeType: string,
}

export interface GoogleFile extends SimpleFile {
    parentId?: FileId;
    parents: string[];
    version: number;
    size?: number;
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
    APPS_SCRIPT: 'application/vnd.google-apps.script'
};
export const MimeToExt = {
    'image/svg+xml': '.svg',
    'application/vnd.oasis.opendocument.text': '.odt'
};
