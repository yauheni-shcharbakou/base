import { Either } from '@sweet-monads/either';

/** The longer side of a document's grid preview — the same as an image's. */
export const DOCUMENT_PREVIEW_MAX_SIDE = 512;

export interface DocumentPreview {
  body: Buffer;
  contentType: string;
}

/**
 * The document cannot be drawn, and no retry will change that: bytes that are no PDF, a password,
 * a first page that takes too long or too much memory to draw.
 */
export class DocumentPreviewUndecodableError extends Error {
  readonly name = 'DocumentPreviewUndecodableError';
}

/** Draws the first page of a document as a small still, for a grid. */
export abstract class DocumentPreviewService {
  /**
   * `left(DocumentPreviewUndecodableError)` for a document no retry can help, `left` of anything
   * else for a failure one might. The buffer is handed over: the caller must not use it after.
   */
  abstract render(document: Buffer): Promise<Either<Error, DocumentPreview>>;
}
