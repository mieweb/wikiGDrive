'use strict';

import { google } from 'googleapis';
import { MarkDownConverter } from './MarkDownConverter';

export class GoogleDocsService {

  async download(auth, file, dest, linkTranslator) {
    return new Promise((resolve, reject) => {
      const docs = google.docs({ version: 'v1', auth });

      docs.documents
        .get({
          documentId: file.id
        }, async (err, res) => {
          if (err) {
            reject(err);
          }

          const data = res.data;

          // console.log(JSON.stringify(data, null, 2))

          const converter = new MarkDownConverter(data, {
            linkTranslator,
            localPath: file.localPath
          });
          const md = await converter.convert();

          let frontMatter = '---\n';
          frontMatter += 'title: ' + file.name + '\n';
          frontMatter += 'date: ' + file.modifiedTime + '\n';
          if (file.lastAuthor) {
            frontMatter += 'author: ' + file.lastAuthor + '\n';
          }
          frontMatter += 'id: ' + file.id + '\n';
          frontMatter += 'source: ' + 'https://drive.google.com/open?id=' + file.id + '\n';
          if (file.htmlPath) {
            frontMatter += 'url: "' + file.htmlPath + '"\n';
          }
          frontMatter += '---\n';

          dest.write(frontMatter);
          dest.write(md);
          dest.end();

          resolve();
        });

    });

  }

}
