import {
  IMAGE_PREVIEW_MAX_SIDE,
  ImagePreview,
  ImagePreviewService,
  ImagePreviewUndecodableError,
} from '@modules/image/domain/services/image.preview.service';
import { Injectable } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import sharp from 'sharp';

const WEBP_QUALITY = 75;

// One image at a time, and nothing kept between them: an original can be a 100 MB GIF, and the
// service is sized for requests, not for an image pipeline. libvips' operation cache only pays off
// when the same image is processed again, which never happens here — and it would keep the
// original's file open after the render, deleted or not.
sharp.cache(false);
sharp.concurrency(1);

@Injectable()
export class SharpImagePreviewServiceImpl implements ImagePreviewService {
  async render(original: Readable): Promise<Either<Error, ImagePreview>> {
    // The original goes to disk, not into a buffer: a buffer of its size is garbage only a major
    // GC frees, and an idle process runs none — the memory stayed taken until the next upload
    // (ADR-0034). libvips maps the file instead, and the unlink below gives it back at once.
    const path = join(tmpdir(), `image-preview-${randomUUID()}`);

    try {
      try {
        await pipeline(original, createWriteStream(path));
      } catch (error) {
        return left(error as Error);
      }

      try {
        // `pages` stays at its default of 1, so an animated GIF or WebP decodes its first frame
        // only — the pixel limit is checked against that frame, and the output is a still.
        const body = await sharp(path, { sequentialRead: true })
          .rotate()
          .resize({
            width: IMAGE_PREVIEW_MAX_SIDE,
            height: IMAGE_PREVIEW_MAX_SIDE,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: WEBP_QUALITY })
          .toBuffer();

        return right({ body, contentType: 'image/webp' });
      } catch (error) {
        return left(new ImagePreviewUndecodableError((error as Error).message));
      }
    } finally {
      await rm(path, { force: true });
    }
  }
}
