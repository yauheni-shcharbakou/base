import { Config } from '@/config';
import {
  DocumentMakePreviewUseCase,
  PREVIEWABLE_DOCUMENT_TYPES,
} from '@modules/document/application/use-cases/document.make-preview.use-case';
import { FileRepository } from '@modules/file/domain/repositories/file.repository';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { left, right } from '@sweet-monads/either';
import { DocumentSweepPreviewsUseCase } from './document.sweep-previews.use-case';

const NOW = new Date('2026-01-01T12:00:00Z');
const LIMIT = 2;
const GRACE_MINUTES = 25;

describe('DocumentSweepPreviewsUseCase', () => {
  let repository: { getManyWithoutPreview: jest.Mock };
  let makePreviewUseCase: { execute: jest.Mock };
  let configService: { getOrThrow: jest.Mock };
  let useCase: DocumentSweepPreviewsUseCase;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    repository = { getManyWithoutPreview: jest.fn().mockResolvedValue([]) };
    makePreviewUseCase = { execute: jest.fn().mockResolvedValue(right(undefined)) };
    configService = {
      getOrThrow: jest.fn().mockReturnValue({ limit: LIMIT, graceMinutes: GRACE_MINUTES }),
    };
    useCase = new DocumentSweepPreviewsUseCase(
      repository as unknown as FileRepository,
      makePreviewUseCase as unknown as DocumentMakePreviewUseCase,
      configService as unknown as ConfigService<Config>,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('reads the documents READY for longer than the configured grace, up to the configured limit', async () => {
    await useCase.execute();

    expect(configService.getOrThrow).toHaveBeenCalledWith('documentPreviewSweep', { infer: true });
    expect(repository.getManyWithoutPreview).toHaveBeenCalledWith(
      PREVIEWABLE_DOCUMENT_TYPES,
      new Date(NOW.getTime() - GRACE_MINUTES * 60_000),
      LIMIT,
      undefined,
    );
  });

  it('reads past the id it is given', async () => {
    await useCase.execute('file-7');

    expect(repository.getManyWithoutPreview).toHaveBeenCalledWith(
      PREVIEWABLE_DOCUMENT_TYPES,
      expect.any(Date),
      LIMIT,
      'file-7',
    );
  });

  it('answers the last id of a full batch, to go on from', async () => {
    repository.getManyWithoutPreview.mockResolvedValue([{ id: 'file-1' }, { id: 'file-2' }]);

    expect(await useCase.execute()).toBe('file-2');
  });

  it('answers nothing once the backlog ended in the batch', async () => {
    repository.getManyWithoutPreview.mockResolvedValue([{ id: 'file-1' }]);
    expect(await useCase.execute()).toBeUndefined();

    repository.getManyWithoutPreview.mockResolvedValue([]);
    expect(await useCase.execute()).toBeUndefined();
  });

  it('goes on to the next document when one gets no preview, and past both', async () => {
    repository.getManyWithoutPreview.mockResolvedValue([{ id: 'file-1' }, { id: 'file-2' }]);
    makePreviewUseCase.execute.mockResolvedValueOnce(left(new Error('provider down')));

    expect(await useCase.execute()).toBe('file-2');
    expect(makePreviewUseCase.execute.mock.calls).toEqual([
      [{ fileId: 'file-1' }],
      [{ fileId: 'file-2' }],
    ]);
  });
});
