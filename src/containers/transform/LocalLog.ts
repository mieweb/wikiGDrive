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
    this.rows = [];
    if (!await this.transformFileService.exists(LOG_NAME)) {
      return;
    }
    const content = await this.transformFileService.readFile(LOG_NAME) || '';
    const rows = content.split('\n').map(row => row.trim()).filter(row => !!row);
    rows.shift();
    for (const row of rows) {
      const cells = row.split(';');

      this.append({
        filePath: cells[0],
        mtime: parseInt(cells[1]),
        id: cells[2],
        type: cells[3],
        event: cells[4]
      });
    }
  }

  append(row: LogRow) {
    if (row.id === 'TO_FILL') {
      return;
    }
    if (row.event === 'touched') {
      if (this.findLastFile(row.id)) {
        return;
      }
    }
    if (!row.mtime) {
      row.mtime = +new Date();
    }
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

  findLastFileByPath(filePath: string) {
    for (let rowNo = this.rows.length - 1; rowNo >= 0; rowNo--) {
      const row = this.rows[rowNo];
      if (row.filePath === filePath) {
        return row;
      }
    }
    return null;
  }

  async remove(filePath: string): Promise<boolean> {
    const originalLength = this.rows.length;
    this.rows = this.rows.filter(logRow => logRow.filePath !== filePath);
    return originalLength !== this.rows.length;
  }

  async getDirFiles(prefix: string): Promise<LogRow[]> {
    const list = this.rows
      .filter(row => row.filePath.startsWith(prefix) && row.filePath.substring(prefix.length).indexOf('/') === -1)
      .filter(row => row.type === 'md');

    const lastOnes: {[key: string]: LogRow} = {};
    for (const item of list) {
      lastOnes[item.filePath] = item;
    }

    return Object.values(lastOnes).filter(item => item.event !== 'removed');
  }

}
