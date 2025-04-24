import fs from 'node:fs';
import path from 'node:path';

export function denoCssPlugin(workspaceRoot: string) {
  function addCssAliasesFromDenoDir(denoDirPath: string, config) {
    const content = fs.readFileSync(path.resolve(denoDirPath, 'deno.json'));
    const json = JSON.parse(new TextDecoder().decode(content));
    if (json.workspace) {
      for (const pack of json.workspace) {
        addCssAliasesFromDenoDir(path.resolve(denoDirPath, pack), config);
      }
    }
    if (json.name && json.exports) {
      const exports = 'string' === typeof json.exports
        ? { '.': json.exports }
        : json.exports;
      for (const [alias, file] of Object.entries(exports)) {
        const fullAlias = path.resolve('/', json.name, alias).substring(1);
        if (file.endsWith('.css')) {
          config.resolve.alias[fullAlias] = path.resolve(
            workspaceRoot,
            path.resolve(denoDirPath, file),
          );
        } else {
          // config.resolve.alias[fullAlias] = path.resolve(
          //   workspaceRoot,
          //   path.resolve(denoDirPath, file),
          // );
        }
      }
    }
  }

  return {
    name: 'deno-css',
    enforce: 'pre',
    config: (config) => {
      config.resolve = config.resolve || {};
      config.resolve.alias = config.resolve.alias || {};
      addCssAliasesFromDenoDir(workspaceRoot, config);
    },
  };
}
