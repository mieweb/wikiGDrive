'use strict';

import {FRONTMATTER_DUMP_OPTS} from './frontmatter';
import yaml from 'js-yaml';
import {DirectoryScanner} from '../DirectoryScanner';
import {FileContentService} from '../../../utils/FileContentService';

export class TocGenerator {

  async dirToMd(dir: FileContentService, level: number) {
    let markdown = '';
    const markDownScanner = new DirectoryScanner();
    const files = await markDownScanner.scanDir(dir);

    const realFileNames = Object.keys(files);
    realFileNames.sort((fileName1, fileName2) => {
      const file1 = files[fileName1];
      const file2 = files[fileName2];
      if (('directory' === file1.type) && !('directory' === file2.type)) {
        return -1;
      }
      if (!('directory' === file1.type) && ('directory' === file2.type)) {
        return 1;
      }

      return file1.title.toLocaleLowerCase().localeCompare(file2.title.toLocaleLowerCase());
    });

    for (const realFileName of realFileNames) {
      const file = files[realFileName];
      let lineStart = '*';
      for (let i = 0; i <= level; i++) {
        lineStart = '   ' + lineStart;
      }

      if (file.type === 'directory') {
        markdown += lineStart + ' ' + file.title + '\n';
        markdown += await this.dirToMd(await dir.getSubFileService(realFileName), level + 1);
      }
      if (file.type === 'md') {
        markdown += lineStart + ' [' + file.title + '](gdoc:' + (file.id) + ')\n';
      }
    }
    return markdown;
  }

  async generate(generatedFileService: FileContentService) {
    const markdown = await this.dirToMd(generatedFileService, 0);

    const fmt = yaml.dump({
      type: 'page',
      title: 'TOC',
      wikigdrive: process.env.GIT_SHA
    }, FRONTMATTER_DUMP_OPTS);

    const frontMatter = '---\n' + fmt + '---\n';

    return frontMatter + markdown;
  }

}
