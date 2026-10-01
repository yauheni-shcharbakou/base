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
const MAX_ATTEMPTS = 3;

describe('DocumentSweepPreviewsUseCase', () => {
  let repository: { getManyWithoutPreview: jest.Mock; countPreviewAttempt: jest.Mock };
  let makePreviewUseCase: { execute: jest.Mock };
  let configService: { getOrThrow: jest.Mock };
  let useCase: DocumentSweepPreviewsUseCase;

  const create = (maxAttempts = MAX_ATTEMPTS, breakerThreshold = 0) => {
    configService = {
      getOrThrow: jest.fn().mockReturnValue({
        limit: LIMIT,
        graceMinutes: GRACE_MINUTES,
        maxAttempts,
        breakerThreshold,
      }),
    };

    return new DocumentSweepPreviewsUseCase(
      repository as unknown as FileRepository,
      makePreviewUseCase as unknown as DocumentMakePreviewUseCase,
      configService as unknown as ConfigService<Config>,
    );
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    repository = {
      getManyWithoutPreview: jest.fn().mockResolvedValue([]),
      countPreviewAttempt: jest.fn().mockResolvedValue(right(false)),
    };
    // `right(true)`: a preview made of an original the provider gave.
    makePreviewUseCase = { execute: jest.fn().mockResolvedValue(right(true)) };
    useCase = create();
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

  it('counts an attempt against the document that got no preview, and against no other', async () => {
    repository.getManyWithoutPreview.mockResolvedValue([{ id: 'file-1' }, { id: 'file-2' }]);
    makePreviewUseCase.execute.mockResolvedValueOnce(left(new Error('provider down')));

    await useCase.execute();

    expect(repository.countPreviewAttempt.mock.calls).toEqual([['file-1', MAX_ATTEMPTS]]);
  });

  it('counts nothing when it never gives up', async () => {
    useCase = create(0);
    repository.getManyWithoutPreview.mockResolvedValue([{ id: 'file-1' }]);
    makePreviewUseCase.execute.mockResolvedValue(left(new Error('provider down')));

    await useCase.execute();

    expect(repository.countPreviewAttempt).not.toHaveBeenCalled();
  });

  it('goes on with the batch when an attempt cannot be counted', async () => {
    repository.getManyWithoutPreview.mockResolvedValue([{ id: 'file-1' }, { id: 'file-2' }]);
    makePreviewUseCase.execute.mockResolvedValue(left(new Error('provider down')));
    repository.countPreviewAttempt.mockResolvedValueOnce(left(new Error('db down')));

    expect(await useCase.execute()).toBe('file-2');
    expect(repository.countPreviewAttempt).toHaveBeenCalledTimes(2);
  });

  describe('the breaker', () => {
    const DOWN = left(new Error('provider down'));

    beforeEach(() => {
      useCase = create(MAX_ATTEMPTS, 2);
      repository.getManyWithoutPreview.mockResolvedValue([
        { id: 'file-1' },
        { id: 'file-2' },
        { id: 'file-3' },
      ]);
    });

    it('stops the sweep at so many documents in a row without a preview, and counts none', async () => {
      repository.getManyWithoutPreview.mockResolvedValue([{ id: 'file-1' }, { id: 'file-2' }]);
      makePreviewUseCase.execute.mockResolvedValue(DOWN);

      expect(await useCase.execute()).toBeUndefined();
      expect(repository.countPreviewAttempt).not.toHaveBeenCalled();
    });

    it('leaves the rest of the batch alone once it stopped', async () => {
      makePreviewUseCase.execute.mockResolvedValue(DOWN);

      await useCase.execute();

      expect(makePreviewUseCase.execute).toHaveBeenCalledTimes(2);
    });

    it('counts the documents that failed before one the provider answered for', async () => {
      makePreviewUseCase.execute
        .mockResolvedValueOnce(DOWN)
        .mockResolvedValueOnce(right(true))
        .mockResolvedValueOnce(DOWN);

      await useCase.execute();

      expect(makePreviewUseCase.execute).toHaveBeenCalledTimes(3);
      expect(repository.countPreviewAttempt.mock.calls).toEqual([
        ['file-1', MAX_ATTEMPTS],
        ['file-3', MAX_ATTEMPTS],
      ]);
    });

    it('keeps the run going over a document that never asked the provider', async () => {
      makePreviewUseCase.execute
        .mockResolvedValueOnce(DOWN)
        .mockResolvedValueOnce(right(false))
        .mockResolvedValueOnce(DOWN);

      expect(await useCase.execute()).toBeUndefined();
      expect(repository.countPreviewAttempt).not.toHaveBeenCalled();
    });

    it('never stops at a threshold of 0', async () => {
      useCase = create(MAX_ATTEMPTS, 0);
      makePreviewUseCase.execute.mockResolvedValue(DOWN);

      await useCase.execute();

      expect(makePreviewUseCase.execute).toHaveBeenCalledTimes(3);
      expect(repository.countPreviewAttempt).toHaveBeenCalledTimes(3);
    });

    it('warns of a threshold no batch is long enough for', () => {
      const warn = jest.spyOn(Logger.prototype, 'warn');

      create(MAX_ATTEMPTS, LIMIT + 1);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('never stops a sweep'));
    });
  });
});
