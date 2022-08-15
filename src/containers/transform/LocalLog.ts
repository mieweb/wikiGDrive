import {FileContentService} from '../../utils/FileContentService';

export interface LogRow {
  filePath: string;
  mtime?: number;
  id: string;
  type: string;
  event: string;
}

export const LOG_NAME = '.wgd-local-log.csv';

export class LocalLog {
  private rows: LogRow[];
  constructor(private transformFileService: FileContentService) {
  }

  async load() {
    if (!await this.transformFileService.exists(LOG_NAME)) {
      this.rows = [];
      return;
    }
    const content = await this.transformFileService.readFile(LOG_NAME) || '';
    const rows = content.split('\n').map(row => row.trim()).filter(row => !!row);
    rows.shift();
    this.rows = rows.map(row => {
      const cells = row.split(';');

      return {
        filePath: cells[0],
        mtime: parseInt(cells[1]),
        id: cells[2],
        type: cells[3],
        event: cells[4]
      };
    });
  }

  append(row: LogRow) {
    row.mtime = +new Date();
    this.rows.push(row);
  }

  getLogs() {
    return this.rows;
  }

  async save() {
    const content = 'filePath;mtime;id;type;event';

    const rowsContent = this.rows.map(row => {
      return `${row.filePath};${row.mtime};${row.id};${row.type};${row.event}`;
    }).join('\n');

    await this.transformFileService.writeFile(LOG_NAME, content + '\n' + rowsContent);
  }

  findLastFile(id: string): LogRow {
    for (let rowNo = this.rows.length - 1; rowNo >= 0; rowNo--) {
      const row = this.rows[rowNo];
      if (row.id === id) {
        return row;
      }
    }
    return null;
  }
}
