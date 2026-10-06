import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { Config } from '@/config';
import { FileDropService } from '@modules/file/application/services/file.drop.service';
import { FileRepository } from '@modules/file/domain/repositories/file.repository';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { StorageVideoService } from '@modules/storage/domain/services/storage.video.service';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { left, right } from '@sweet-monads/either';
import { FileCleanupUseCase, UPLOAD_GRACE_MINUTES } from './file.cleanup.use-case';

const NOW = new Date('2026-01-01T12:00:00Z');
const FILE_WINDOW_MINUTES = 60;
const VIDEO_WINDOW_MINUTES = 120;

describe('FileCleanupUseCase', () => {
  let repository: {
    failPendingBefore: Mock;
    getMany: Mock;
    getManyInDeletedStorageObjects: Mock;
  };
  let dropService: { drop: Mock };
  let useCase: FileCleanupUseCase;

  beforeEach(() => {
    vi.useFakeTimers().setSystemTime(NOW);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    repository = {
      failPendingBefore: vi.fn().mockResolvedValue(right(0)),
      getMany: vi.fn().mockResolvedValue([]),
      getManyInDeletedStorageObjects: vi.fn().mockResolvedValue([]),
    };
    dropService = { drop: vi.fn().mockResolvedValue(true) };
    useCase = new FileCleanupUseCase(
      repository as unknown as FileRepository,
      dropService as unknown as FileDropService,
      { uploadWindowMinutes: FILE_WINDOW_MINUTES } as StorageFileService,
      { uploadWindowMinutes: VIDEO_WINDOW_MINUTES } as StorageVideoService,
      { getOrThrow: () => 24 } as unknown as ConfigService<Config>,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('fails the uploads older than the longer upload window and its grace', async () => {
    await useCase.execute();

    const minutes = VIDEO_WINDOW_MINUTES + UPLOAD_GRACE_MINUTES;
    expect(repository.failPendingBefore).toHaveBeenCalledWith(
      new Date(NOW.getTime() - minutes * 60_000),
    );
  });

  it('marks before it sweeps, so a row past the TTL is dropped whichever it was', async () => {
    await useCase.execute();

    expect(repository.failPendingBefore.mock.invocationCallOrder[0]).toBeLessThan(
      repository.getMany.mock.invocationCallOrder[0],
    );
  });

  it('still sweeps when the mark fails', async () => {
    repository.failPendingBefore.mockResolvedValue(left(new Error('db down')));
    repository.getMany.mockResolvedValue([{ id: 'stale' }]);

    await useCase.execute();

    expect(dropService.drop).toHaveBeenCalledWith([{ id: 'stale' }]);
    expect(repository.getManyInDeletedStorageObjects).toHaveBeenCalled();
  });
});
