export type OutputMode = 'md' | 'html' | 'raw';

export interface MarkdownChunk {
  isTag: boolean;
  txt: string;
  mode: OutputMode;
}

export class MarkdownChunks {
  chunks: MarkdownChunk[] = [];

  get length() {
    return this.chunks.length;
  }

  push(s: MarkdownChunk) {
    this.chunks.push(s);
  }

  toString() {
    return this.chunks.map(c => c.txt).join('');
  }

  extractText(start: number, end: number) {
    const slice = this.chunks.slice(start, end).filter(i => !i.isTag).map(i => i.txt).join('');
    return slice;
  }
}
