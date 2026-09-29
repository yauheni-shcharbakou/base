import {
  IMAGE_PREVIEW_MAX_SIDE,
  ImagePreview,
  ImagePreviewService,
  ImagePreviewUndecodableError,
} from '@modules/image/domain/services/image.preview.service';
import { Injectable } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import sharp from 'sharp';

const WEBP_QUALITY = 75;

// One image at a time, and nothing kept between them: an original can be a 100 MB GIF, and the
// service is sized for requests, not for an image pipeline. libvips' operation cache only pays off
// when the same image is processed again, which never happens here.
sharp.cache(false);
sharp.concurrency(1);

@Injectable()
export class SharpImagePreviewServiceImpl implements ImagePreviewService {
  async render(original: Buffer): Promise<Either<ImagePreviewUndecodableError, ImagePreview>> {
    try {
      // `pages` stays at its default of 1, so an animated GIF or WebP decodes its first frame only
      // — the pixel limit is checked against that frame, and the output is a still.
      const body = await sharp(original, { sequentialRead: true })
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
  }
}
