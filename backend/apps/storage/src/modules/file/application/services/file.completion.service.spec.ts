import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { FileEventBus, FilePurgeType } from '@backend/event-bus';
import { NestStorage } from '@backend/proto';
import { FilePurgeService } from '@modules/file/application/services/file.purge.service';
import { FileRepository } from '@modules/file/domain/repositories/file.repository';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { BadRequestException, ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import { FileCompletionService } from './file.completion.service';

const { FAILED, PENDING, READY } = NestStorage.FileUploadStatus;

const file = (uploadStatus = PENDING) =>
  ({ id: 'file-1', providerId: 'dev/u/a.jpg', size: 10, uploadStatus }) as NestStorage.File;

describe('FileCompletionService', () => {
  let repository: Record<'updateOne' | 'getById' | 'updateById', Mock>;
  let storage: { getObjectSize: Mock };
  let purge: { purge: Mock };
  let eventBus: { emitReady: Mock };
  let service: FileCompletionService;

  beforeEach(() => {
    repository = {
      updateOne: vi.fn().mockResolvedValue(right(file(READY))),
      getById: vi.fn().mockResolvedValue(right(file(READY))),
      updateById: vi.fn(),
    };
    storage = { getObjectSize: vi.fn().mockResolvedValue(right(10)) };
    purge = { purge: vi.fn() };
    eventBus = { emitReady: vi.fn().mockResolvedValue(undefined) };

    service = new FileCompletionService(
      repository as unknown as FileRepository,
      storage as unknown as StorageFileService,
      purge as unknown as FilePurgeService,
      eventBus as unknown as FileEventBus,
    );
  });

  it('announces the file once it turns READY', async () => {
    const result = await service.complete(file());

    expect(result.isRight()).toBe(true);
    expect(eventBus.emitReady).toHaveBeenCalledWith(file(READY));
  });

  it('announces nothing when a repeated call finds the file READY already', async () => {
    const result = await service.complete(file(READY));

    expect(result.value).toEqual(file(READY));
    expect(storage.getObjectSize).not.toHaveBeenCalled();
    expect(eventBus.emitReady).not.toHaveBeenCalled();
  });

  it('announces nothing when a concurrent call made it READY first', async () => {
    repository.updateOne.mockResolvedValue(left(new NotFoundException()));

    const result = await service.complete(file());

    expect(result.isRight()).toBe(true);
    expect(eventBus.emitReady).not.toHaveBeenCalled();
  });

  // The upload did complete; a lost event only delays the preview until the sweep.
  it('still answers the READY file when the emit fails', async () => {
    const logError = vi.spyOn(Logger.prototype, 'error').mockReturnValue(undefined);
    eventBus.emitReady.mockRejectedValue(new Error('Redis is down'));

    const result = await service.complete(file());

    expect(result.isRight()).toBe(true);
    expect(logError).toHaveBeenCalled();
    logError.mockRestore();
  });

  it('leaves the row alone while the bytes have not arrived', async () => {
    storage.getObjectSize.mockResolvedValue(right(null));

    const result = await service.complete(file());

    expect(result.value).toBeInstanceOf(ConflictException);
    expect(repository.updateById).not.toHaveBeenCalled();
    expect(repository.updateOne).not.toHaveBeenCalled();
  });

  it('fails the file and purges its bytes when the size is not the declared one', async () => {
    vi.spyOn(Logger.prototype, 'warn').mockReturnValue(undefined);
    storage.getObjectSize.mockResolvedValue(right(7));

    const result = await service.complete(file());

    expect(result.value).toBeInstanceOf(BadRequestException);
    expect(repository.updateById).toHaveBeenCalledWith('file-1', {
      set: { uploadStatus: FAILED },
    });
    expect(purge.purge).toHaveBeenCalledWith([
      { type: FilePurgeType.FILE, providerId: 'dev/u/a.jpg' },
    ]);
    expect(eventBus.emitReady).not.toHaveBeenCalled();
  });

  it('refuses a file with no Storage key', async () => {
    const result = await service.complete({ ...file(), providerId: undefined });

    expect(result.value).toBeInstanceOf(BadRequestException);
    expect(storage.getObjectSize).not.toHaveBeenCalled();
  });
});
