import {
  IMAGE_PREVIEW_MAX_SIDE,
  ImagePreviewUndecodableError,
} from '@modules/image/domain/services/image.preview.service';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { SharpImagePreviewServiceImpl } from './sharp.image.preview.service.impl';

const RED = { r: 200, g: 20, b: 20, alpha: 1 };

const png = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 4, background: RED } })
    .png()
    .toBuffer();

describe('SharpImagePreviewServiceImpl', () => {
  const service = new SharpImagePreviewServiceImpl();
  const systemTmpDir = process.env.TMPDIR;
  let tmpDir: string;

  // A directory of its own, so what a render leaves behind can be counted.
  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'image-preview-spec-'));
    process.env.TMPDIR = tmpDir;
  });

  afterAll(async () => {
    if (systemTmpDir === undefined) {
      delete process.env.TMPDIR;
    } else {
      process.env.TMPDIR = systemTmpDir;
    }

    await rm(tmpDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    expect(await readdir(tmpDir)).toEqual([]);
  });

  const rendered = async (original: Buffer) => {
    const result = await service.render(Readable.from([original]));

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
    const result = await service.render(Readable.from([Buffer.from('definitely not an image')]));

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ImagePreviewUndecodableError);
  });

  it('answers a broken stream with a plain error, which a retry may fix', async () => {
    const original = await png(100, 40);
    let isSent = false;
    const broken = new Readable({
      read() {
        if (isSent) {
          this.destroy(new Error('socket hang up'));
          return;
        }

        isSent = true;
        this.push(original.subarray(0, 20));
      },
    });

    const result = await service.render(broken);

    expect(result.isLeft()).toBe(true);
    expect(result.value).not.toBeInstanceOf(ImagePreviewUndecodableError);
    expect((result.value as Error).message).toBe('socket hang up');
  });
});
