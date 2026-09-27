import { NestStorage } from '@backend/proto';
import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import { left, right } from '@sweet-monads/either';
import { StorageObjectGetFoldersUseCase } from './storage-object.get-folders.use-case';

const folders = [{ id: 'root', folderPath: '/' }] as NestStorage.StorageObjectPopulated[];

describe('StorageObjectGetFoldersUseCase', () => {
  let repository: { getAllChildrenIds: jest.Mock; getMany: jest.Mock };
  let useCase: StorageObjectGetFoldersUseCase;

  beforeEach(() => {
    repository = {
      getAllChildrenIds: jest.fn().mockResolvedValue(right(new Set(['child']))),
      getMany: jest.fn().mockResolvedValue(folders),
    };

    useCase = new StorageObjectGetFoldersUseCase(repository as unknown as StorageObjectRepository);
  });

  it('lists every folder of the user with its path', async () => {
    const result = await useCase.execute({ userId: 'user-1' });

    expect(result.isRight() && result.value).toBe(folders);
    expect(repository.getAllChildrenIds).not.toHaveBeenCalled();
    expect(repository.getMany).toHaveBeenCalledWith(
      { userId: 'user-1', isFolder: true },
      { populate: ['folderPath'] },
    );
  });

  // The picker of a move: neither the folder itself nor anything under it is a valid target.
  it('leaves out the folder and its subtree', async () => {
    await useCase.execute({ userId: 'user-1', excludeChildrenOf: 'moved' });

    expect(repository.getMany).toHaveBeenCalledWith(
      { userId: 'user-1', isFolder: true, excludeIds: ['child', 'moved'] },
      { populate: ['folderPath'] },
    );
  });

  it('fails instead of offering the subtree when the walk fails', async () => {
    const failure = new Error('connection lost');
    repository.getAllChildrenIds.mockResolvedValue(left(failure));

    const result = await useCase.execute({ userId: 'user-1', excludeChildrenOf: 'moved' });

    expect(result.isLeft() && result.value).toBe(failure);
    expect(repository.getMany).not.toHaveBeenCalled();
  });
});
