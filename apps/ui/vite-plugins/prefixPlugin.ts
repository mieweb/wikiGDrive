import process from 'node:process';
import { Plugin } from 'vite';
import {
  DenoResolveResult,
  resolveDeno,
  resolveViteSpecifier,
} from './resolver.ts';

export default function denoPrefixPlugin(
  cache: Map<string, DenoResolveResult>,
): Plugin {
  let root = process.cwd();

  return {
    name: 'deno:prefix',
    enforce: 'pre',
    configResolved(config) {
      root = config.root;
    },
    async resolveId(id, importer) {
      if (id.startsWith('npm:')) {
        const resolved = await resolveDeno(id, root);
        if (resolved === null) return;

        // TODO: Resolving custom versions is not supported at the moment
        const actual = resolved.id.slice(0, resolved.id.indexOf('@'));
        const result = await this.resolve(actual);
        return result ?? actual;
      } else if (id.startsWith('http:') || id.startsWith('https:')) {
        return await resolveViteSpecifier(id, cache, root, importer);
      }
    },
  };
}
