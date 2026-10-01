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

const SETTINGS = { limit: 2, graceMinutes: 25, maxAttempts: 3, breakerThreshold: 0 };

// What a sweep does is specced once, on `PreviewSweepUseCase`; here, what the document sweep
// runs on.
describe('DocumentSweepPreviewsUseCase', () => {
  let repository: { getManyWithoutPreview: jest.Mock; countPreviewAttempt: jest.Mock };
  let makePreviewUseCase: { execute: jest.Mock };
  let configService: { getOrThrow: jest.Mock };
  let useCase: DocumentSweepPreviewsUseCase;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    repository = {
      getManyWithoutPreview: jest.fn().mockResolvedValue([{ id: 'file-1' }]),
      countPreviewAttempt: jest.fn().mockResolvedValue(right(false)),
    };
    makePreviewUseCase = { execute: jest.fn().mockResolvedValue(right(true)) };
    configService = { getOrThrow: jest.fn().mockReturnValue(SETTINGS) };

    useCase = new DocumentSweepPreviewsUseCase(
      repository as unknown as FileRepository,
      makePreviewUseCase as unknown as DocumentMakePreviewUseCase,
      configService as unknown as ConfigService<Config>,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('is tuned by the document sweep settings', () => {
    expect(configService.getOrThrow).toHaveBeenCalledWith('documentPreviewSweep', { infer: true });
  });

  it('reads the files of the previewable types without a preview', async () => {
    await useCase.execute('file-0');

    expect(repository.getManyWithoutPreview).toHaveBeenCalledWith(
      PREVIEWABLE_DOCUMENT_TYPES,
      expect.any(Date),
      SETTINGS.limit,
      'file-0',
    );
  });

  it('makes the preview of each file', async () => {
    await useCase.execute();

    expect(makePreviewUseCase.execute).toHaveBeenCalledWith({ fileId: 'file-1' });
  });

  it('counts a failed sweep against the file', async () => {
    makePreviewUseCase.execute.mockResolvedValue(left(new Error('provider down')));

    await useCase.execute();

    expect(repository.countPreviewAttempt).toHaveBeenCalledWith('file-1', SETTINGS.maxAttempts);
  });
});
