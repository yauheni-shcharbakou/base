import { FileDeleteByOwnerUseCase } from '@modules/file/application/use-cases/file.delete-by-owner.use-case';
import { FileRepository } from '@modules/file/domain/repositories/file.repository';
import { StorageObjectDeleteRootFolderUseCase } from '@modules/storage-object/application/use-cases/storage-object.delete-root-folder.use-case';
import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import { UserDirectoryService } from '@modules/user/domain/services/user-directory.service';
import { Logger } from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import { UserPurgeDeletedUseCase } from './user.purge-deleted.use-case';

describe('UserPurgeDeletedUseCase', () => {
  let directory: { count: jest.Mock; getExistingIds: jest.Mock };
  let fileRepository: { getOwnerIds: jest.Mock };
  let storageObjectRepository: { getLiveOwnerIds: jest.Mock };
  let deleteRootFolder: { execute: jest.Mock };
  let deleteMedia: { execute: jest.Mock };
  let useCase: UserPurgeDeletedUseCase;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    directory = {
      count: jest.fn().mockResolvedValue(right(2)),
      getExistingIds: jest.fn().mockResolvedValue(right(new Set(['alive']))),
    };
    fileRepository = { getOwnerIds: jest.fn().mockResolvedValue(['alive', 'gone']) };
    storageObjectRepository = { getLiveOwnerIds: jest.fn().mockResolvedValue(['alive', 'stale']) };
    deleteRootFolder = { execute: jest.fn().mockResolvedValue(right(undefined)) };
    deleteMedia = { execute: jest.fn().mockResolvedValue(right(0)) };

    useCase = new UserPurgeDeletedUseCase(
      directory as unknown as UserDirectoryService,
      fileRepository as unknown as FileRepository,
      storageObjectRepository as unknown as StorageObjectRepository,
      deleteRootFolder as unknown as StorageObjectDeleteRootFolderUseCase,
      deleteMedia as unknown as FileDeleteByOwnerUseCase,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('purges the tree and the media of every owner auth no longer knows', async () => {
    const result = await useCase.execute();

    expect(result.isRight() && result.value).toBe(2);
    expect(directory.getExistingIds).toHaveBeenCalledWith(['alive', 'gone', 'stale']);
    expect(deleteRootFolder.execute.mock.calls).toEqual([['gone'], ['stale']]);
    expect(deleteMedia.execute.mock.calls).toEqual([['gone'], ['stale']]);
  });

  it('asks auth in batches', async () => {
    const owners = Array.from({ length: 501 }, (_, i) => `u${i}`);
    fileRepository.getOwnerIds.mockResolvedValue(owners);
    storageObjectRepository.getLiveOwnerIds.mockResolvedValue([]);
    directory.getExistingIds.mockImplementation((ids: string[]) =>
      Promise.resolve(right(new Set(ids))),
    );

    await useCase.execute();

    expect(directory.getExistingIds).toHaveBeenCalledTimes(2);
    expect(directory.getExistingIds.mock.calls[1][0]).toEqual(['u500']);
    expect(deleteRootFolder.execute).not.toHaveBeenCalled();
  });

  it('refuses to purge when auth reports no users at all', async () => {
    directory.count.mockResolvedValue(right(0));

    const result = await useCase.execute();

    expect(result.isLeft()).toBe(true);
    expect(directory.getExistingIds).not.toHaveBeenCalled();
    expect(deleteRootFolder.execute).not.toHaveBeenCalled();
  });

  it('purges nothing when auth cannot be asked', async () => {
    const error = new Error('auth is down');
    directory.getExistingIds.mockResolvedValue(left(error));

    const result = await useCase.execute();

    expect(result.isLeft() && result.value).toBe(error);
    expect(deleteRootFolder.execute).not.toHaveBeenCalled();
    expect(deleteMedia.execute).not.toHaveBeenCalled();
  });

  it('goes on with the others when one user fails, and does not count it', async () => {
    deleteMedia.execute.mockResolvedValueOnce(left(new Error('db down')));

    const result = await useCase.execute();

    expect(result.isRight() && result.value).toBe(1);
    expect(deleteMedia.execute).toHaveBeenCalledWith('stale');
  });
});
