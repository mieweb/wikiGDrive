'use strict';

import * as fs from 'fs';
import * as JSZip from 'jszip';
import * as crypto from 'crypto';
import {ExternalFiles} from '../storage/ExternalFiles';

export class UnZipper {
    private html: string;
    private readonly images: {};

    constructor(private externalFiles: ExternalFiles) {
        this.html = '<html></html>';
        this.images = {};
    }

    async load(zipPath: string) {
        const jsZip = new JSZip();
        const zip = await jsZip.loadAsync(fs.readFileSync(zipPath));

        const files = {};
        zip.folder('').forEach((relativePath, entry) => {
            files[relativePath] = entry;
        });

        for (const relativePath in files) {
            if (relativePath.endsWith('.html')) {
                this.html = await (zip.file(relativePath).async('string'));
            }
            if (relativePath.endsWith('.png')) {
                const md5Checksum = await new Promise<string>(resolve => {
                    const hash = crypto.createHash('md5');
                    hash.setEncoding('hex');

                    files[relativePath].nodeStream()
                        .on('end', () => {
                            hash.end();
                            resolve(hash.read());
                        })
                        .pipe(hash);
                });

                const externalFile = this.externalFiles.findFile(file => file.md5Checksum === md5Checksum);
                if (externalFile) {
                    this.images[relativePath] = md5Checksum;
                }
            }
        }
    }

    getHtml() {
        return this.html;
    }

    getImages() {
        return this.images;
    }
}
