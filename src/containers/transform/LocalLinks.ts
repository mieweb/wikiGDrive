import {FileContentService} from '../../utils/FileContentService';

interface Link {
  fileId: string;
  links: string[];
}

export const LINKS_NAME = '.wgd-local-links.csv';

export class LocalLinks {
  private links: Link[];
  constructor(private generatedFileService: FileContentService) {
  }

  async load() {
    if (!await this.generatedFileService.exists(LINKS_NAME)) {
      this.links = [];
      return;
    }
    const content = await this.generatedFileService.readFile(LINKS_NAME) || '';
    const rows = content.split('\n').map(row => row.trim()).filter(row => !!row);
    rows.shift();
    const groups = {};
    for (const row of rows) {
      const cells = row.split(';');
      if (!groups[cells[0]]) {
        groups[cells[0]] = {
          fileId: cells[0],
          links: []
        };
      }
      groups[cells[0]].links.push(cells[1]);
    }
    this.links = Object.values(groups);
  }

  append(fileId: string, links: string[]) {
    const link = this.links.find(l => l.fileId === fileId);
    if (link) {
      link.links = links;
    } else {
      this.links.push({
        fileId, links
      });
    }
  }

  async save() {
    const content = 'source;dest';

    const rowsContent = this.links.map(row => {
      return row.links.map(dest => {
        return `${row.fileId};${dest}`;
      }).join('\n').trim();
    }).join('\n');

    await this.generatedFileService.writeFile(LINKS_NAME, content + '\n' + rowsContent);
  }
}
