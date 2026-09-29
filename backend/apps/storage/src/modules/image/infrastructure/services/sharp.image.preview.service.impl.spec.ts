import {
  IMAGE_PREVIEW_MAX_SIDE,
  ImagePreviewUndecodableError,
} from '@modules/image/domain/services/image.preview.service';
import sharp from 'sharp';
import { SharpImagePreviewServiceImpl } from './sharp.image.preview.service.impl';

const RED = { r: 200, g: 20, b: 20, alpha: 1 };

const png = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 4, background: RED } })
    .png()
    .toBuffer();

describe('SharpImagePreviewServiceImpl', () => {
  const service = new SharpImagePreviewServiceImpl();

  const rendered = async (original: Buffer) => {
    const result = await service.render(original);

    if (result.isLeft()) {
      throw result.value;
    }

    expect(result.value.contentType).toBe('image/webp');
    return sharp(result.value.body).metadata();
  };

  it('fits a large image into the preview side, keeping its proportions', async () => {
    const meta = await rendered(await png(2000, 1000));

    expect(meta.format).toBe('webp');
    expect([meta.width, meta.height]).toEqual([IMAGE_PREVIEW_MAX_SIDE, IMAGE_PREVIEW_MAX_SIDE / 2]);
  });

  it('never enlarges a small image', async () => {
    const meta = await rendered(await png(100, 40));

    expect([meta.width, meta.height]).toEqual([100, 40]);
  });

  it('turns an animated GIF into a still of its first frame', async () => {
    // Distinct frames: the GIF encoder folds identical ones into one.
    const frames = await Promise.all(
      [200, 100, 20].map((r) =>
        sharp({ create: { width: 800, height: 600, channels: 4, background: { ...RED, r } } })
          .png()
          .toBuffer(),
      ),
    );
    const animated = await sharp(frames, { join: { animated: true } })
      .gif()
      .toBuffer();

    expect((await sharp(animated).metadata()).pages).toBe(3);

    const meta = await rendered(animated);

    expect(meta.pages ?? 1).toBe(1);
    expect([meta.width, meta.height]).toEqual([IMAGE_PREVIEW_MAX_SIDE, 384]);
  });

  it('applies the EXIF orientation before resizing', async () => {
    // Orientation 6: stored landscape, shown rotated a quarter turn — portrait.
    const rotated = await sharp(await png(1000, 500))
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const meta = await rendered(rotated);

    expect([meta.width, meta.height]).toEqual([IMAGE_PREVIEW_MAX_SIDE / 2, IMAGE_PREVIEW_MAX_SIDE]);
  });

  it('refuses bytes that are no image as undecodable', async () => {
    const result = await service.render(Buffer.from('definitely not an image'));

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ImagePreviewUndecodableError);
  });
});
