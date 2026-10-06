import {
  DOCUMENT_PREVIEW_MAX_SIDE,
  DocumentPreview,
  DocumentPreviewService,
  DocumentPreviewUndecodableError,
} from '@modules/document/domain/services/document.preview.service';
import type {
  PdfFirstPageReply,
  PdfFirstPageRequest,
} from '@modules/document/infrastructure/workers/pdf-first-page.worker';
import { Injectable } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import { extname, join } from 'node:path';
import { Worker } from 'node:worker_threads';

const WEBP_QUALITY = 75;

/** A first page that takes longer is given up on, and its worker killed. */
export const DOCUMENT_PREVIEW_TIMEOUT_MS = 20_000;

// The worker's own heap, pdf.js's structures included. The document and the canvas are outside it,
// in the service's memory.
const WORKER_HEAP_MB = 512;

// Beside this file: compiled `.js` in `dist`, or `.ts` when run from source (the e2e suite), where
// the worker inherits the loader from `execArgv` — `--test*` flags left out, which a worker refuses.
const WORKER_FILE = join(__dirname, '..', 'workers', `pdf-first-page.worker${extname(__filename)}`);
const workerExecArgv = () => process.execArgv.filter((arg) => !arg.startsWith('--test'));

// A buffer is handed to the worker without a copy only when it owns its whole memory: a small one
// is a slice of Node's shared pool, and a shorter read is a slice of its allocation.
const toTransferable = (buffer: Buffer): Uint8Array =>
  buffer.byteOffset === 0 && buffer.byteLength === buffer.buffer.byteLength
    ? buffer
    : new Uint8Array(buffer);

/**
 * Draws a PDF's first page with pdf.js and `@napi-rs/canvas`, in a worker thread per document: the
 * event loop that serves gRPC and the webhook stays free, and a document that hangs pdf.js or runs
 * it out of memory ends with its worker, not with the service (ADR-0032).
 */
@Injectable()
export class PdfjsDocumentPreviewServiceImpl implements DocumentPreviewService {
  // A field, not a constructor parameter, which Nest would try to inject: a spec overrides it.
  protected readonly timeoutMs: number = DOCUMENT_PREVIEW_TIMEOUT_MS;

  render(document: Buffer): Promise<Either<Error, DocumentPreview>> {
    const data = toTransferable(document);
    const request: PdfFirstPageRequest = {
      document: data,
      maxSide: DOCUMENT_PREVIEW_MAX_SIDE,
      quality: WEBP_QUALITY,
    };

    return new Promise((resolve) => {
      const worker = new Worker(WORKER_FILE, {
        workerData: request,
        transferList: [data.buffer as ArrayBuffer],
        resourceLimits: { maxOldGenerationSizeMb: WORKER_HEAP_MB },
        execArgv: workerExecArgv(),
      });
      let isSettled = false;

      const settle = (result: Either<Error, DocumentPreview>) => {
        if (isSettled) {
          return;
        }

        isSettled = true;
        clearTimeout(timer);
        void worker.terminate();
        resolve(result);
      };

      const timer = setTimeout(
        () =>
          settle(
            left(
              new DocumentPreviewUndecodableError(
                `the first page took over ${this.timeoutMs / 1000} s to draw`,
              ),
            ),
          ),
        this.timeoutMs,
      );

      worker.once('message', ({ body, error }: PdfFirstPageReply) => {
        if (error) {
          settle(
            left(
              error.isUndecodable
                ? new DocumentPreviewUndecodableError(error.message)
                : new Error(error.message),
            ),
          );
        } else {
          const preview = Buffer.from(body.buffer, body.byteOffset, body.byteLength);
          settle(right({ body: preview, contentType: 'image/webp' }));
        }
      });

      worker.once('error', (error: NodeJS.ErrnoException) =>
        settle(
          left(
            error.code === 'ERR_WORKER_OUT_OF_MEMORY'
              ? new DocumentPreviewUndecodableError('the first page ran out of memory')
              : error,
          ),
        ),
      );

      worker.once('exit', (code) => settle(left(new Error(`the renderer exited with ${code}`))));
    });
  }
}
