export type OutputMode = 'md' | 'html' | 'raw';



export interface MarkdownChunk {
  txt: string;
  mode: OutputMode;
}

export class MarkdownChunks {
  chunks: MarkdownChunk[] = [];

  push(s: MarkdownChunk) {
    this.chunks.push(s);
  }

  toString() {
    return this.chunks.map(c => c.txt).join('');
  }
}
