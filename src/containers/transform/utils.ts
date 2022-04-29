import {FileContentService} from '../../utils/FileContentService';

export function fileNameToExt(fileName: string) {
  const idx = fileName.lastIndexOf('.');
  if (idx > -1) {
    return fileName.substring(idx + 1);
  }
  return 'bin';
}

export function getFileDir(filePath) {
  const parts = filePath.split('/');
  if (parts.length < 2) {
    return '/';
  }
  parts.pop();
  return parts.join('/');
}

export async function removeMarkDownsAndImages(removePath: string, localFilesService: FileContentService): Promise<void> {
  await localFilesService.remove(removePath);
  const imagesPath = removePath.replace(/.md$/, '.assets');
  if (removePath !== imagesPath) {
    await localFilesService.remove(imagesPath);
  }
}
