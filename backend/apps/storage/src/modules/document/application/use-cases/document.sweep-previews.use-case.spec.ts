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
const LIMIT = 7;
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
    );
  });

  it('goes on to the next document when one gets no preview', async () => {
    repository.getManyWithoutPreview.mockResolvedValue([{ id: 'file-1' }, { id: 'file-2' }]);
    makePreviewUseCase.execute.mockResolvedValueOnce(left(new Error('provider down')));

    await useCase.execute();

    expect(makePreviewUseCase.execute.mock.calls).toEqual([
      [{ fileId: 'file-1' }],
      [{ fileId: 'file-2' }],
    ]);
  });
});
