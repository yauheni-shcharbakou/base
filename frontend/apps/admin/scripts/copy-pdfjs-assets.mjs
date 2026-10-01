// Copies the files pdf.js fetches at runtime — CMaps, standard fonts, ICC profiles and the wasm
// decoders (JPEG 2000, JBIG2) — out of the installed `pdfjs-dist` into `public/pdfjs/`, where
// `PdfDocumentView` points its `cMapUrl` / `standardFontDataUrl` / `iccUrl` / `wasmUrl`. Taken from
// the package itself, so they always match the worker's version. The output is gitignored and
// rebuilt on every `dev` and `build`.
import { cp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSET_DIRS = ['cmaps', 'standard_fonts', 'iccs', 'wasm'];

const require = createRequire(import.meta.url);
const source = dirname(require.resolve('pdfjs-dist/package.json'));
const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'pdfjs');

await rm(target, { recursive: true, force: true });

for (const dir of ASSET_DIRS) {
  await cp(join(source, dir), join(target, dir), { recursive: true });
}
