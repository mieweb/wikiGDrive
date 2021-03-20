import slugify from 'slugify';
import {GoogleFile, GoogleFiles} from './GoogleFiles';

const MAX_FILENAME_LENGTH = 100;

export function getDesiredPath(name) {
    name = name.replace(/[&]+/g, ' and ');
    name = name.replace(/[/:()]+/g, ' ');
    name = name.trim();
    name = slugify(name, { replacement: '-', lower: true });
    return name;
}

export class LocalPathGenerator {

    constructor(private googleFiles: GoogleFiles, private flat_folder_structure: boolean) {
    }

    generateDesiredPaths(changedFiles: GoogleFile[]) {
        changedFiles = changedFiles.map(changedFile => {
            const clone = JSON.parse(JSON.stringify(changedFile));
            clone.desiredLocalPath = null;
            return clone;
        });

        const retVal = [];

        let filesWithoutPath = changedFiles.filter(file => !file.desiredLocalPath).length;

        while (filesWithoutPath > 0) {
            for (const changedFile of changedFiles) {
                if (!changedFile.desiredLocalPath) {
                    changedFile.desiredLocalPath = this.generateDesiredPath(changedFile, changedFiles);
                    if (!changedFile.desiredLocalPath) {
                        continue;
                    }

                    if (changedFile.desiredLocalPath.length > MAX_FILENAME_LENGTH) {
                        changedFile.desiredLocalPath = changedFile.desiredLocalPath.substr(0, MAX_FILENAME_LENGTH);
                    }

                    switch (changedFile.mimeType) {
                        case 'application/vnd.google-apps.drawing':
                            changedFile.desiredLocalPath += '.svg';
                            break;
                        case 'application/vnd.google-apps.document':
                            changedFile.desiredLocalPath += '.md';
                            break;
                    }
                    retVal.push(changedFile);
                }
            }

            filesWithoutPath = changedFiles.filter(file => !file.desiredLocalPath).length;
        }

        retVal.sort((a, b) => {
          return -(a.desiredLocalPath.length - b.desiredLocalPath.length);
        });

        return retVal;
    }

    generateDesiredPath(changedFile: GoogleFile, changedFiles: GoogleFile[]) {
        if (this.flat_folder_structure) {
            return getDesiredPath(changedFile.name);
        }

        if (!changedFile.parentId) {
            return getDesiredPath(changedFile.name);
        }

        const parent = changedFiles.find(file => file.id === changedFile.parentId);
        if (parent) {
            const parentDirName = parent.desiredLocalPath;
            if (parentDirName) {
                const slugifiedParent = parentDirName
                    .split('/')
                    .map(part => getDesiredPath(part))
                    .join('/');

                return slugifiedParent + '/' + getDesiredPath(changedFile.name);
            }
        } else {
            const parent = this.googleFiles.findFile(file => file.id === changedFile.parentId);
            if (parent) {
                const parentDirName = parent.desiredLocalPath;
                if (parentDirName) {
                    const slugifiedParent = parentDirName
                        .split('/')
                        .map(part => getDesiredPath(part))
                        .join('/');

                    return slugifiedParent + '/' + getDesiredPath(changedFile.name);
                }
            } else {
                return 'external_docs/' + changedFile.parentId + '/' + getDesiredPath(changedFile.name);
            }
        }

        return null;
    }

}
