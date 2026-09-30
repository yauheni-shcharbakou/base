import { createCanvas } from '@napi-rs/canvas';
import { dirname, join } from 'node:path';
import { parentPort, workerData } from 'node:worker_threads';

export interface PdfFirstPageRequest {
  document: Uint8Array;
  maxSide: number;
  quality: number;
}

// One shape, not a union: the service's build runs without `strict`, where a union does not narrow.
export interface PdfFirstPageReply {
  body?: Uint8Array;
  // `isUndecodable`: the document is at fault, and no retry will change it; else pdf.js is.
  error?: { isUndecodable: boolean; message: string };
}

// The files pdf.js reads at runtime — CMaps, standard fonts, ICC profiles, the JPEG 2000 and JBIG2
// decoders — straight from the installed package: in Node they are paths, not URLs.
const pdfjsRoot = dirname(require.resolve('pdfjs-dist/package.json'));
const assetDir = (name: string) => join(pdfjsRoot, name) + '/';

/**
 * Draws the first page of a PDF, its longer side `maxSide`, over white, as a webp. Runs in a worker
 * thread of its own (`PdfjsDocumentPreviewServiceImpl`): pdf.js in Node parses and draws on the
 * thread that calls it, and a heavy or hostile document would hold the service's event loop.
 */
async function render({
  document,
  maxSide,
  quality,
}: PdfFirstPageRequest): Promise<PdfFirstPageReply> {
  let pdfjs: typeof import('pdfjs-dist/legacy/build/pdf.mjs');

  try {
    // ESM only; `import()` survives the CommonJS build.
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  } catch (error) {
    return { error: { isUndecodable: false, message: `pdf.js failed to load: ${error.message}` } };
  }

  const task = pdfjs.getDocument({
    data: document,
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
    standardFontDataUrl: assetDir('standard_fonts'),
    cMapUrl: assetDir('cmaps'),
    cMapPacked: true,
    iccUrl: assetDir('iccs'),
    wasmUrl: assetDir('wasm'),
  });

  try {
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const { width, height } = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: maxSide / Math.max(width, height) });
    const canvas = createCanvas(
      Math.max(1, Math.round(viewport.width)),
      Math.max(1, Math.round(viewport.height)),
    );
    const context = canvas.getContext('2d');

    // A page is transparent where nothing is drawn; a webp of it would show the grid's background.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    return { body: await canvas.encode('webp', quality) };
  } catch (error) {
    return { error: { isUndecodable: true, message: error.message } };
  } finally {
    await task.destroy();
  }
}

if (parentPort) {
  const port = parentPort;
  void render(workerData as PdfFirstPageRequest).then((reply) => port.postMessage(reply));
}
