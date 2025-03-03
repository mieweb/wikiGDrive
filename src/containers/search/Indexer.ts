// import {LunrIndexer} from './LunrIndexer.ts';
import {OramaIndexer} from './OramaIndexer.ts';

export interface SearchResults {
  result: any[];
}

export interface PageToIndex {
  content: string;
  id: string;
  title: string;
  path: string;
}

export interface Indexer {
  addPage(page: PageToIndex): Promise<void>;
  getData(): Promise<Uint8Array>;
  setData(data: Uint8Array): Promise<void>;
  search(term: string): Promise<SearchResults>;
  getFileName(): string;
}

export function createIndexer() {
  return OramaIndexer.init();
}
