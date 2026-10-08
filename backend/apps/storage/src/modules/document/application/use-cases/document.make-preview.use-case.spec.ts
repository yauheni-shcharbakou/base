import { beforeAll, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { FilePurgeType } from '@backend/event-bus';
import { NestStorage } from '@backend/proto';
import {
  DocumentPreviewService,
  DocumentPreviewUndecodableError,
} from '@modules/document/domain/services/document.preview.service';
import { FilePurgeService } from '@modules/file/application/services/file.purge.service';
import { FileRepository } from '@modules/file/domain/repositories/file.repository';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import { Readable } from 'node:stream';
import {
  DOCUMENT_PREVIEW_MAX_BYTES,
  DocumentMakePreviewUseCase,
} from './document.make-preview.use-case';

const { READY, PENDING } = NestStorage.FileUploadStatus;
const BYTES = Buffer.from('%PDF-1.4 original bytes');
const PREVIEW = { body: Buffer.from('webp'), contentType: 'image/webp' };

const file = (overrides: Partial<NestStorage.File> = {}) =>
  ({
    id: 'file-1',
    providerId: 'dev/u/a.pdf',
    mimeType: 'application/pdf',
    size: BYTES.length,
    uploadStatus: READY,
    ...overrides,
  }) as NestStorage.File;

describe('DocumentMakePreviewUseCase', () => {
  let repository: Record<'getById' | 'setPreview' | 'markPreviewFailed' | 'isExistsById', Mock>;
  let fileService: Record<'getObjectStream' | 'putObject' | 'createPreviewKey', Mock>;
  let previewService: { render: Mock };
  let purgeService: { purge: Mock };
  let useCase: DocumentMakePreviewUseCase;

  const run = () => useCase.execute({ fileId: 'file-1' });

  beforeAll(() => {
    vi.spyOn(Logger.prototype, 'warn').mockReturnValue(undefined);
  });

  beforeEach(() => {
    repository = {
      getById: vi.fn().mockResolvedValue(right(file())),
      setPreview: vi.fn().mockResolvedValue(right(true)),
      markPreviewFailed: vi.fn().mockResolvedValue(right(true)),
      isExistsById: vi.fn().mockResolvedValue(true),
    };
    fileService = {
      // A fresh stream per call: one is consumed by the read.
      getObjectStream: vi
        .fn()
        .mockImplementation(() => Promise.resolve(right(Readable.from([BYTES])))),
      putObject: vi.fn().mockResolvedValue(right(true)),
      createPreviewKey: vi.fn().mockReturnValue('dev/u/a.preview.webp'),
    };
    previewService = { render: vi.fn().mockResolvedValue(right(PREVIEW)) };
    purgeService = { purge: vi.fn().mockResolvedValue(undefined) };

    useCase = new DocumentMakePreviewUseCase(
      repository as unknown as FileRepository,
      fileService as unknown as StorageFileService,
      previewService,
      purgeService as unknown as FilePurgeService,
    );
  });

  it('draws the first page, stores the webp beside the PDF and records its key', async () => {
    const result = await run();

    // `true`: the provider answered on the way, which the sweep's breaker goes by.
    expect(result.value).toBe(true);
    expect(fileService.getObjectStream).toHaveBeenCalledWith('dev/u/a.pdf');
    expect(previewService.render).toHaveBeenCalledWith(BYTES);
    expect(fileService.putObject).toHaveBeenCalledWith(
      'dev/u/a.preview.webp',
      PREVIEW.body,
      'image/webp',
    );
    expect(repository.setPreview).toHaveBeenCalledWith('file-1', 'dev/u/a.preview.webp');
  });

  // The last column: whether the provider answered on the way — one too heavy is never asked for.
  it.each([
    [
      'undecodable',
      () =>
        previewService.render.mockResolvedValue(left(new DocumentPreviewUndecodableError('bad'))),
      true,
    ],
    ['missing', () => fileService.getObjectStream.mockResolvedValue(right(null)), true],
    [
      'too heavy to draw',
      () =>
        repository.getById.mockResolvedValue(right(file({ size: DOCUMENT_PREVIEW_MAX_BYTES + 1 }))),
      false,
    ],
  ])(
    'marks the preview failed when the document is %s, and answers right',
    async (_, arrange, isProviderAnswer) => {
      arrange();

      const result = await run();

      expect(result.value).toBe(isProviderAnswer);
      expect(repository.markPreviewFailed).toHaveBeenCalledWith('file-1');
      expect(repository.setPreview).not.toHaveBeenCalled();
    },
  );

  it('never downloads a document too heavy to draw', async () => {
    repository.getById.mockResolvedValue(right(file({ size: DOCUMENT_PREVIEW_MAX_BYTES + 1 })));

    await run();

    expect(fileService.getObjectStream).not.toHaveBeenCalled();
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
    ['the renderer', () => previewService.render.mockResolvedValue(left(new Error('no pdf.js')))],
    [
      'the stream',
      () =>
        fileService.getObjectStream.mockResolvedValue(
          right(
            new Readable({
              read() {
                this.destroy(new Error('socket hang up'));
              },
            }),
          ),
        ),
    ],
  ])('answers left when %s fails, so it is retried', async (_, arrange) => {
    arrange();

    const result = await run();

    expect(result.isLeft()).toBe(true);
    expect(repository.setPreview).not.toHaveBeenCalled();
    expect(repository.markPreviewFailed).not.toHaveBeenCalled();
  });

  it('purges its own preview when the file was deleted meanwhile', async () => {
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
    ['a deleted file', () => repository.getById.mockResolvedValue(left(new NotFoundException()))],
    [
      'a file that is no PDF',
      () => repository.getById.mockResolvedValue(right(file({ mimeType: 'text/plain' }))),
    ],
    [
      'a preview already made',
      () => repository.getById.mockResolvedValue(right(file({ previewProviderId: 'k' }))),
    ],
    [
      'an upload not READY',
      () => repository.getById.mockResolvedValue(right(file({ uploadStatus: PENDING }))),
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
