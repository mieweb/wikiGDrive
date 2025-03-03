import lunr from 'lunr';
import stemmerSupport from 'lunr-languages/lunr.stemmer.support.js';
import { Indexer, PageToIndex } from './Indexer.ts';

stemmerSupport(lunr);

lunr.tokenizer.separator = /[\s-_@#,.]+/;

export class LunrIndexer implements Indexer {
  private lunrBuilder: lunr.Builder;
  private store: Record<string, any>;
  lunrIndex: lunr.Index;

  constructor() {
    this.lunrBuilder = new lunr.Builder();
    this.lunrBuilder.ref('path');
    this.lunrBuilder.field('id2', {
      extractor: (doc) => {
        return doc['id'] ? doc['id'].replace(/[_-]*/g, '') : undefined;
      }
    });
    this.lunrBuilder.field('id');
    this.lunrBuilder.field('title');
    this.store = {};
  }

  static async init() {
    return new LunrIndexer();
  }

  async addPage(page: PageToIndex) {
    this.lunrBuilder.add({
      path: page.path,
      title: page.title,
      id: page.id
    });

    this.store[page.path] = {
      title: page.title,
      id: page.id
    };
  }

  async getData() {
    const lunrIndex = this.lunrBuilder.build();
    const str = JSON.stringify({ index: lunrIndex.toJSON(), store: this.store });
    return new TextEncoder().encode(str);
  }

  async setData(data: Uint8Array) {
    this.lunrIndex = undefined;
    this.store = {};

    try {
      const lunrData = JSON.parse(new TextDecoder().decode(data));
      this.store = lunrData.store || {};
      if (lunrData?.index) {
        this.lunrIndex = lunr.Index.load(lunrData.index);
      }
    // deno-lint-ignore no-unused-vars
    } catch (err) {
      this.store = {};
    }
  }

  async search(queryParam: string) {
    if (!this.lunrIndex) {
      return {
        result: []
      };
    }

    queryParam = (queryParam || '').trim().replace(/:/g, ' ');

    let result = this.lunrIndex.search(queryParam);
    if (result.length === 0 && queryParam.indexOf('*') === -1) {
      result = this.lunrIndex.search(queryParam.split(/\s+/g).map(w => w.length > 2 ? w + '*' : w).join(' '));
    }
    if (result.length === 0 && queryParam.replace(/[_-]*/g, '').length > 10) {
      result = this.lunrIndex.search(queryParam.replace(/[_-]*/g, ''));
    }

    return {
      result: result.map((doc) => ({
        path: doc.ref,
        score: doc.score,
        matchData: doc.matchData,
        ...this.store[doc.ref]
      }))
    };
  }

  getFileName() {
    return 'lonr.json';
  }
}
