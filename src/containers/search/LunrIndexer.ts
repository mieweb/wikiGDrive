import lunr from 'lunr';
import stemmerSupport from 'lunr-languages/lunr.stemmer.support.js';

stemmerSupport(lunr);

lunr.tokenizer.separator = /[\s-_@#,.]+/;

export class LunrIndexer {
  private lunrBuilder: lunr.Builder;
  private store;

  constructor() {
    this.lunrBuilder = new lunr.Builder();
    this.lunrBuilder.ref('path');
    this.lunrBuilder.field('id2', { extractor: (doc) => {
        return doc['id'] ? doc['id'].replace(/[_-]*/g, '') : undefined;
    }});
    this.lunrBuilder.field('id');
    this.lunrBuilder.field('title');
    this.store = {};
  }

  async addPage(page) {
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

  getJson() {
    const lunrIndex = this.lunrBuilder.build();
    return { index: lunrIndex.toJSON(), store: this.store };
  }

}
