import path from 'npm:path';
import { copy, exists } from '@std/fs';
import { build, emptyDir } from '@deno/dnt';

const __dirname = import.meta.dirname!;

interface DenoJson {
  homepage: any;
  bugs: any;
  contributors: any;
  author: any;
  repository: any;
  keywords: any;
  license: any;
  description: any;
  name: string;
  exports: string | Map<string, string>;
}

async function readDenoJson(workspaceRoot: string) {
  const content = Deno.readFileSync(path.resolve(workspaceRoot, 'deno.json'));
  return JSON.parse(new TextDecoder().decode(content));
}

async function iterateWorkspaces(
  workspaceRoot: string,
  callback: (workspaceRoot: string, json: DenoJson) => Promise<void>,
): Promise<void> {
  const json = await readDenoJson(workspaceRoot);
  if (json.workspace) {
    for (const pack of json.workspace) {
      await iterateWorkspaces(path.resolve(workspaceRoot, pack), callback);
    }
  }
  if (json.name && json.exports) {
    await callback(workspaceRoot, json);
  }
}

const workspaceRoot = path.resolve(__dirname, '..');
const mainJson = await readDenoJson(workspaceRoot);

await emptyDir('./npm');

await iterateWorkspaces(workspaceRoot, async (workspaceRoot, json) => {
  const exports = 'string' === typeof json.exports
    ? { '.': json.exports }
    : json.exports;

  if (Object.keys(exports).length === 0) {
    return;
  }

  console.info(`Building: ${workspaceRoot}`);

  const entryPoints = [];
  for (const [name, file] of Object.entries(exports)) {
    entryPoints.push({
      name,
      path: path.resolve(workspaceRoot, file),
    });
  }

  await build({
    entryPoints,
    outDir: path.resolve('./npm', json.name),
    shims: {
      // see JS docs for overview and more options
      deno: true,
    },
    package: {
      // package.json properties
      name: json.name,
      version: Deno.args[0]?.replace(/^v/, ''),
      description: json.description || mainJson.description,
      keywords: json.keywords || mainJson.keywords,
      repository: json.repository || mainJson.repository,
      author: json.author || mainJson.author,
      contributors: json.contributors || mainJson.contributors,
      bugs: json.bugs || mainJson.bugs,
      homepage: json.homepage || mainJson.homepage,
      license: json.license || mainJson.license,
    },
    async postBuild() {
      if (await exists(path.resolve('LICENSE'))) {
        Deno.copyFileSync('LICENSE', path.resolve('npm', json.name, 'LICENSE'));
      }
      Deno.copyFileSync(
        'README.md',
        path.resolve('npm', json.name, 'README.md'),
      );
      if (await exists(path.resolve(workspaceRoot, 'README.md'))) {
        Deno.copyFileSync(
          path.resolve(workspaceRoot, 'README.md'),
          path.resolve('npm', json.name, 'README.md'),
        );
      }
      if (await exists(path.resolve(workspaceRoot, 'assets'))) {
        await copy(
          path.resolve(workspaceRoot, 'assets'),
          path.resolve('npm', json.name, 'assets'),
          { overwrite: true, preserveTimestamps: true },
        );
      }
    },
    mappings: {},
    compilerOptions: {
      lib: ['ES2022'],
    },
    typeCheck: false,
    test: false,
    scriptModule: false,
  });
});
