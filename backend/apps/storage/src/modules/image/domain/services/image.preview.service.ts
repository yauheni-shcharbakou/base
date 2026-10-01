import { Either } from '@sweet-monads/either';
import { Readable } from 'node:stream';

/** The longest side of a preview, in pixels — a grid tile on a 2x screen. */
export const IMAGE_PREVIEW_MAX_SIDE = 512;

export interface ImagePreview {
  body: Buffer;
  contentType: string;
}

/** The bytes are not an image the renderer can read. A retry would fail the same way. */
export class ImagePreviewUndecodableError extends Error {
  readonly name = 'ImagePreviewUndecodableError';
}

export abstract class ImagePreviewService {
  /**
   * A still, at most `IMAGE_PREVIEW_MAX_SIDE` on its longest side and never enlarged. An animated
   * original gives its first frame.
   *
   * The original comes as a stream, so how its bytes are held is the renderer's business — never
   * the caller's heap. An `ImagePreviewUndecodableError` is about the bytes; any other error is
   * about reading them, and a retry may fix it.
   */
  abstract render(original: Readable): Promise<Either<Error, ImagePreview>>;
}
