import { ZipReader } from 'https://deno.land/x/zipjs/index.js';
import { createMD5, createSHA256 } from 'hash-wasm';

export class AssetUnzipper {
  constructor(
    private zipPath: string,
    private outputDir: string,
  ) {}

  async unzip(
    shouldInclude: (fileName: string) => boolean = () => true,
  ): Promise<Record<string, string>> {
    await Deno.mkdir(this.outputDir, { recursive: true });

    const fileMap: Record<string, string> = {};

    const file = await Deno.open(this.zipPath, { read: true });
    const reader = new ZipReader(file.readable);

    try {
      const entries = await reader.getEntries();

      for (const entry of entries) {
        if (entry.directory) continue;
        if (!shouldInclude(entry.filename)) continue;

        const finalName = await this.processEntry(entry);

        fileMap[entry.filename] = finalName;
      }
    } finally {
      await reader.close();
    }

    return fileMap;
  }

  private async processEntry(entry: any): Promise<string> {
    const hasher = await createMD5();

    const tempPath = `${this.outputDir}/tmp-${crypto.randomUUID()}`;
    const outFile = await Deno.open(tempPath, {
      write: true,
      create: true,
      truncate: true,
    });

    const writable = new WritableStream<Uint8Array>({
      async write(chunk) {
        hasher.update(chunk);
        await outFile.write(chunk);
      },
      close() {
        outFile.close();
      },
      abort() {
        outFile.close();
      },
    });

    // stream unzip → hash + write
    await entry.getData(writable);

    const hash = hasher.digest('hex');

    // 🔹 extract extension safely
    const ext = this.getExtension(entry.filename);

    const finalName = ext ? `${hash}.${ext}` : hash;
    const finalPath = `${this.outputDir}/${finalName}`;

    // deduplicate
    try {
      await Deno.stat(finalPath);
      await Deno.remove(tempPath);
    } catch {
      await Deno.rename(tempPath, finalPath);
    }

    return finalName;
  }

  private getExtension(fileName: string): string | null {
    const base = fileName.split('/').pop() ?? '';
    const idx = base.lastIndexOf('.');
    if (idx <= 0 || idx === base.length - 1) return null;
    return base.slice(idx + 1).toLowerCase();
  }
}
