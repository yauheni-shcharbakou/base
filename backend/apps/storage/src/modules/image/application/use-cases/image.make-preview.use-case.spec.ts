import { beforeAll, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { FilePurgeType } from '@backend/event-bus';
import { NestStorage } from '@backend/proto';
import { FilePurgeService } from '@modules/file/application/services/file.purge.service';
import { ImageRepository } from '@modules/image/domain/repositories/image.repository';
import {
  ImagePreviewService,
  ImagePreviewUndecodableError,
} from '@modules/image/domain/services/image.preview.service';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import { Readable } from 'node:stream';
import { ImageMakePreviewUseCase, LIGHT_ORIGINAL_MAX_BYTES } from './image.make-preview.use-case';

const { READY, PENDING } = NestStorage.FileUploadStatus;
const BYTES = Buffer.from('original bytes');
const PREVIEW = { body: Buffer.from('webp'), contentType: 'image/webp' };

const image = (
  overrides: Partial<NestStorage.ImagePopulated> = {},
  file: Partial<NestStorage.File> = {},
) =>
  ({
    id: 'image-1',
    fileId: 'file-1',
    width: 4000,
    height: 3000,
    ...overrides,
    file: {
      id: 'file-1',
      providerId: 'dev/u/a.jpg',
      mimeType: 'image/jpeg',
      size: BYTES.length,
      uploadStatus: READY,
      ...file,
    },
  }) as NestStorage.ImagePopulated;

describe('ImageMakePreviewUseCase', () => {
  let repository: Record<'getOne' | 'setPreview' | 'markPreviewFailed' | 'isExistsById', Mock>;
  let fileService: Record<'getObjectStream' | 'putObject' | 'createPreviewKey', Mock>;
  let previewService: { render: Mock };
  let purgeService: { purge: Mock };
  let useCase: ImageMakePreviewUseCase;

  const run = () => useCase.execute({ fileId: 'file-1' });

  beforeAll(() => {
    vi.spyOn(Logger.prototype, 'warn').mockReturnValue(undefined);
  });

  beforeEach(() => {
    repository = {
      getOne: vi.fn().mockResolvedValue(right(image())),
      setPreview: vi.fn().mockResolvedValue(right(true)),
      markPreviewFailed: vi.fn().mockResolvedValue(right(true)),
      isExistsById: vi.fn().mockResolvedValue(true),
    };
    fileService = {
      getObjectStream: vi
        .fn()
        .mockImplementation(() => Promise.resolve(right(Readable.from([BYTES])))),
      putObject: vi.fn().mockResolvedValue(right(true)),
      createPreviewKey: vi.fn().mockReturnValue('dev/u/a.preview.webp'),
    };
    previewService = { render: vi.fn().mockResolvedValue(right(PREVIEW)) };
    purgeService = { purge: vi.fn().mockResolvedValue(undefined) };

    useCase = new ImageMakePreviewUseCase(
      repository as unknown as ImageRepository,
      fileService as unknown as StorageFileService,
      previewService as unknown as ImagePreviewService,
      purgeService as unknown as FilePurgeService,
    );
  });

  it('renders the original, stores the webp beside it and records its key', async () => {
    const result = await run();

    // `true`: the provider answered on the way, which the sweep's breaker goes by.
    expect(result.value).toBe(true);
    expect(fileService.getObjectStream).toHaveBeenCalledWith('dev/u/a.jpg');
    // The stream itself: the original never becomes a buffer on this side (ADR-0034).
    expect(previewService.render).toHaveBeenCalledWith(expect.any(Readable));
    expect(fileService.putObject).toHaveBeenCalledWith(
      'dev/u/a.preview.webp',
      PREVIEW.body,
      'image/webp',
    );
    expect(repository.setPreview).toHaveBeenCalledWith('image-1', 'dev/u/a.preview.webp');
  });

  it('makes a light original its own preview, without downloading it', async () => {
    repository.getOne.mockResolvedValue(
      right(image({ width: 512, height: 300 }, { mimeType: 'image/png', size: 1000 })),
    );

    const result = await run();

    expect(result.value).toBe(false);
    expect(fileService.getObjectStream).not.toHaveBeenCalled();
    expect(repository.setPreview).toHaveBeenCalledWith('image-1', 'dev/u/a.jpg');
  });

  it('renders a GIF however small its sides, since its weight is in the frames', async () => {
    repository.getOne.mockResolvedValue(
      right(image({ width: 200, height: 200 }, { mimeType: 'image/gif' })),
    );

    await run();

    expect(previewService.render).toHaveBeenCalled();
    expect(repository.setPreview).toHaveBeenCalledWith('image-1', 'dev/u/a.preview.webp');
  });

  it('shows a light SVG as it is and gives up on a heavy one', async () => {
    repository.getOne.mockResolvedValue(right(image({}, { mimeType: 'image/svg+xml', size: 10 })));
    expect((await run()).value).toBe(false);
    expect(repository.setPreview).toHaveBeenCalledWith('image-1', 'dev/u/a.jpg');

    repository.getOne.mockResolvedValue(
      right(image({}, { mimeType: 'image/svg+xml', size: LIGHT_ORIGINAL_MAX_BYTES + 1 })),
    );
    expect((await run()).value).toBe(false);
    expect(repository.markPreviewFailed).toHaveBeenCalledWith('image-1');
    expect(fileService.getObjectStream).not.toHaveBeenCalled();
  });

  it.each([
    [
      'undecodable',
      () => previewService.render.mockResolvedValue(left(new ImagePreviewUndecodableError('bad'))),
    ],
    ['missing', () => fileService.getObjectStream.mockResolvedValue(right(null))],
  ])('marks the preview failed when the original is %s, and answers right', async (_, arrange) => {
    arrange();

    const result = await run();

    // The provider answered either way: with the bytes, or that there are none.
    expect(result.value).toBe(true);
    expect(repository.markPreviewFailed).toHaveBeenCalledWith('image-1');
    expect(repository.setPreview).not.toHaveBeenCalled();
  });

  it.each([
    [
      'the read',
      () => fileService.getObjectStream.mockResolvedValue(left(new InternalServerErrorException())),
    ],
    [
      'the write',
      () => fileService.putObject.mockResolvedValue(left(new InternalServerErrorException())),
    ],
    // What the renderer answers when the original's stream breaks under it.
    [
      'the stream',
      () => previewService.render.mockResolvedValue(left(new Error('socket hang up'))),
    ],
  ])('answers left when %s fails, so it is retried', async (_, arrange) => {
    arrange();

    const result = await run();

    expect(result.isLeft()).toBe(true);
    expect(repository.setPreview).not.toHaveBeenCalled();
    expect(repository.markPreviewFailed).not.toHaveBeenCalled();
  });

  it('purges its own preview when the image was deleted meanwhile', async () => {
    repository.setPreview.mockResolvedValue(right(false));
    repository.isExistsById.mockResolvedValue(false);

    await run();

    expect(purgeService.purge).toHaveBeenCalledWith([
      { type: FilePurgeType.FILE, providerId: 'dev/u/a.preview.webp' },
    ]);
  });

  it('keeps the preview when a concurrent run recorded the same key first', async () => {
    repository.setPreview.mockResolvedValue(right(false));

    await run();

    expect(purgeService.purge).not.toHaveBeenCalled();
  });

  it.each([
    ['a plain file', () => repository.getOne.mockResolvedValue(left(new NotFoundException()))],
    [
      'a preview already made',
      () => repository.getOne.mockResolvedValue(right(image({ previewProviderId: 'k' }))),
    ],
    [
      'an upload not READY',
      () => repository.getOne.mockResolvedValue(right(image({}, { uploadStatus: PENDING }))),
    ],
  ])('does nothing for %s', async (_, arrange) => {
    arrange();

    const result = await run();

    expect(result.value).toBe(false);
    expect(fileService.getObjectStream).not.toHaveBeenCalled();
    expect(repository.setPreview).not.toHaveBeenCalled();
    expect(repository.markPreviewFailed).not.toHaveBeenCalled();
  });
});
