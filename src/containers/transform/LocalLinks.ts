import {FileContentService} from '../../utils/FileContentService';

interface Link {
  fileId: string;
  fileName: string;
  links: string[];
}

export const LINKS_NAME = '.wgd-local-links.csv';

export class LocalLinks {
  private links: Link[];
  constructor(private transformFileService: FileContentService) {
  }

  async load() {
    if (!await this.transformFileService.exists(LINKS_NAME)) {
      this.links = [];
      return;
    }
    const content = await this.transformFileService.readFile(LINKS_NAME) || '';
    const rows = content.split('\n').map(row => row.trim()).filter(row => !!row);
    rows.shift();
    const groups = {};
    for (const row of rows) {
      const cells = row.split(';');
      if (!groups[cells[0]]) {
        groups[cells[0]] = {
          fileId: cells[0],
          fileName: cells[1],
          links: []
        };
      }
      groups[cells[0]].links.push(cells[2]);
    }
    this.links = Object.values(groups);
  }

  append(fileId: string, fileName: string, links: string[]) {
    const link = this.links.find(l => l.fileId === fileId);
    if (link) {
      link.fileName = fileName;
      link.links = links;
    } else {
      this.links.push({
        fileId, fileName, links
      });
    }
  }

  getBackLinks(fileId) {
    const retVal = new Set<string>();
    for (const link of this.links) {
      for (const targetLink of link.links) {
        if (targetLink === 'gdoc:' + fileId) {
          retVal.add(link.fileId);
        }
      }
    }
    return Array.from(retVal);
  }

  async save() {
    const content = 'source;name;dest';

    const rowsContent = this.links.map(row => {
      return row.links.map(dest => {
        return `${row.fileId};${row.fileName};${dest}`;
      }).join('\n').trim();
    }).join('\n');

    await this.transformFileService.writeFile(LINKS_NAME, content + '\n' + rowsContent);
  }
}
