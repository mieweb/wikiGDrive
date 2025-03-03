import { create, load, save, insert, search } from '@orama/orama';
import type { Orama, RawData } from '@orama/orama';
import msgpack from '@msgpack/msgpack';
import '@tensorflow/tfjs-node'; // Or any other appropriate TensorflowJS backend, like @tensorflow/tfjs-backend-webgl

import { pluginEmbeddings } from './pluginEmbeddings.ts';

import {Indexer, SearchResults, PageToIndex} from './Indexer.ts';

const plugin = await pluginEmbeddings({
  embeddings: {
    defaultProperty: 'embeddings',
    onInsert: {
      generate: true,
      properties: ['title', 'content']
    }
  }
});

export class OramaIndexer implements Indexer {
  private constructor(private db: Orama<unknown, unknown, unknown, unknown>) {
  }

  static async init() {
    const db = create({
      schema: {
        title: 'string',
        id: 'string',
        path: 'string',
        embeddings: 'vector[512]',
      },
      plugins: [plugin]
    });

    return new OramaIndexer(db);
  }

  async addPage(page: PageToIndex): Promise<void> {
    insert(this.db, {
      title: page.title,
      id: page.id,
      path: page.path,
      content: page.content
    });
  }

  async search(term: string): Promise<SearchResults> {
    const results = await search(this.db, {
      term,
      mode: 'vector',
      similarity: 0.5,
    });

    return {
      result: results.hits.map(h => ({
        score: h.score,
        id: h?.document?.id,
        path: h?.document?.path,
        title: h?.document?.title,
      }))
    };
  }

  async setData(data: Uint8Array): Promise<void> {
    load(this.db, <RawData>msgpack.decode(data));
  }

  async getData(): Promise<Uint8Array> {
    return msgpack.encode(save(this.db));
  }

  getFileName() {
    return 'orama.msgpack';
  }
}
