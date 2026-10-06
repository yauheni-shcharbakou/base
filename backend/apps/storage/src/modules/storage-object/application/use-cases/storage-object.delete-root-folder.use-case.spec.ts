import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { NestStorage } from '@backend/proto';
import { StorageObject } from '@modules/storage-object/domain/entities/storage-object.interface';
import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import { StorageObjectDeleteRootFolderUseCase } from './storage-object.delete-root-folder.use-case';

const USER_ID = 'owner';

const root = {
  id: 'root',
  userId: USER_ID,
  isFolder: true,
  type: NestStorage.StorageObjectType.FOLDER,
  isDeleted: false,
} as StorageObject;

describe('StorageObjectDeleteRootFolderUseCase', () => {
  let repository: {
    withTreeLock: Mock;
    getOne: Mock;
    markDeletedWithDescendants: Mock;
  };
  let useCase: StorageObjectDeleteRootFolderUseCase;

  beforeEach(() => {
    repository = {
      withTreeLock: vi.fn((_userId: string, work: () => Promise<unknown>) => work()),
      getOne: vi.fn().mockResolvedValue(right(root)),
      markDeletedWithDescendants: vi.fn().mockResolvedValue(right(5)),
    };

    useCase = new StorageObjectDeleteRootFolderUseCase(
      repository as unknown as StorageObjectRepository,
    );
  });

  it('marks the live root folder with everything under it, under the owner lock', async () => {
    const result = await useCase.execute(USER_ID);

    expect(result.isRight()).toBe(true);
    expect(repository.withTreeLock).toHaveBeenCalledWith(USER_ID, expect.any(Function));
    expect(repository.getOne).toHaveBeenCalledWith({
      userId: USER_ID,
      isFolder: true,
      isRoot: true,
      isDeleted: false,
    });
    expect(repository.markDeletedWithDescendants).toHaveBeenCalledWith(root.id);
  });

  // A redelivery finds the root marked already, or removed by the cleanup.
  it('succeeds without a write when there is no live root folder', async () => {
    repository.getOne.mockResolvedValue(left(new NotFoundException()));

    const result = await useCase.execute(USER_ID);

    expect(result.isRight()).toBe(true);
    expect(repository.markDeletedWithDescendants).not.toHaveBeenCalled();
  });

  it('fails when the root folder cannot be read', async () => {
    const error = new InternalServerErrorException();
    repository.getOne.mockResolvedValue(left(error));

    const result = await useCase.execute(USER_ID);

    expect(result.isLeft() && result.value).toBe(error);
    expect(repository.markDeletedWithDescendants).not.toHaveBeenCalled();
  });

  it('fails when the mark fails, so the event is retried', async () => {
    const error = new Error('db down');
    repository.markDeletedWithDescendants.mockResolvedValue(left(error));

    const result = await useCase.execute(USER_ID);

    expect(result.isLeft() && result.value).toBe(error);
  });
});
