import { FileEventBus } from '@backend/event-bus';
import { NestStorage } from '@backend/proto';
import { FilePurgeService } from '@modules/file/application/services/file.purge.service';
import { FileRepository } from '@modules/file/domain/repositories/file.repository';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { Logger, NotFoundException } from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import { FileCompleteUploadUseCase } from './file.complete-upload.use-case';

const { PENDING, READY } = NestStorage.FileUploadStatus;

const file = (uploadStatus = PENDING) =>
  ({ id: 'file-1', providerId: 'dev/u/a.jpg', size: 10, uploadStatus }) as NestStorage.File;

describe('FileCompleteUploadUseCase', () => {
  let repository: Record<'getOne' | 'updateOne' | 'getById' | 'updateById', jest.Mock>;
  let eventBus: { emitReady: jest.Mock };
  let useCase: FileCompleteUploadUseCase;

  const complete = () => useCase.execute({ id: 'file-1', userId: 'u' });

  beforeEach(() => {
    repository = {
      getOne: jest.fn().mockResolvedValue(right(file())),
      updateOne: jest.fn().mockResolvedValue(right(file(READY))),
      getById: jest.fn().mockResolvedValue(right(file(READY))),
      updateById: jest.fn(),
    };
    eventBus = { emitReady: jest.fn().mockResolvedValue(undefined) };

    useCase = new FileCompleteUploadUseCase(
      repository as unknown as FileRepository,
      { getObjectSize: jest.fn().mockResolvedValue(right(10)) } as unknown as StorageFileService,
      { purge: jest.fn() } as unknown as FilePurgeService,
      eventBus as unknown as FileEventBus,
    );
  });

  it('announces the file once it turns READY', async () => {
    const result = await complete();

    expect(result.isRight()).toBe(true);
    expect(eventBus.emitReady).toHaveBeenCalledWith(file(READY));
  });

  it('announces nothing when a repeated call finds the file READY already', async () => {
    repository.getOne.mockResolvedValue(right(file(READY)));

    await complete();

    expect(eventBus.emitReady).not.toHaveBeenCalled();
  });

  it('announces nothing when a concurrent call made it READY first', async () => {
    repository.updateOne.mockResolvedValue(left(new NotFoundException()));

    const result = await complete();

    expect(result.isRight()).toBe(true);
    expect(eventBus.emitReady).not.toHaveBeenCalled();
  });

  // The upload did complete; a lost event only delays the preview until the sweep.
  it('still answers the READY file when the emit fails', async () => {
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    eventBus.emitReady.mockRejectedValue(new Error('Redis is down'));

    const result = await complete();

    expect(result.isRight()).toBe(true);
    expect(logError).toHaveBeenCalled();
    logError.mockRestore();
  });
});
