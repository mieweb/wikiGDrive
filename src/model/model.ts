export type LinkMode = 'dirURLs' | 'mdURLs' | 'uglyURLs';

export type DateISO = string;
export type FileId = string;

export interface DriveConfig {
  drive: string;
  drive_id: string;
  dest: string;

  link_mode: LinkMode;
}
