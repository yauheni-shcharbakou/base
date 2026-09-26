import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import { Logger } from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import { StorageObjectCleanupUseCase } from './storage-object.cleanup.use-case';

describe('StorageObjectCleanupUseCase', () => {
  let repository: { deleteEmptyDeletedFolders: jest.Mock };
  let useCase: StorageObjectCleanupUseCase;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    repository = { deleteEmptyDeletedFolders: jest.fn() };
    useCase = new StorageObjectCleanupUseCase(repository as unknown as StorageObjectRepository);
  });

  afterEach(() => jest.restoreAllMocks());

  // Each pass removes one level; the next level only becomes empty once the one below is gone.
  it('repeats passes until one finds nothing', async () => {
    repository.deleteEmptyDeletedFolders
      .mockResolvedValueOnce(right(4))
      .mockResolvedValueOnce(right(2))
      .mockResolvedValueOnce(right(1))
      .mockResolvedValueOnce(right(0));

    await useCase.execute();

    expect(repository.deleteEmptyDeletedFolders).toHaveBeenCalledTimes(4);
  });

  it('stops at the first failed pass', async () => {
    repository.deleteEmptyDeletedFolders
      .mockResolvedValueOnce(right(4))
      .mockResolvedValueOnce(left(new Error('deadlock')));

    await useCase.execute();

    expect(repository.deleteEmptyDeletedFolders).toHaveBeenCalledTimes(2);
  });

  it('gives up after a bounded number of passes', async () => {
    repository.deleteEmptyDeletedFolders.mockResolvedValue(right(1));

    await useCase.execute();

    expect(repository.deleteEmptyDeletedFolders).toHaveBeenCalledTimes(100);
  });
});
