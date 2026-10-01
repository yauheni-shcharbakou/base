import { NestStorage } from '@backend/proto';
import { StorageObject } from '@modules/storage-object/domain/entities/storage-object.interface';
import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import { StorageObjectDeleteOneUseCase } from './storage-object.delete-one.use-case';

const folder = {
  id: 'folder-1',
  userId: 'owner',
  isFolder: true,
  parentId: 'root',
  type: NestStorage.StorageObjectType.FOLDER,
  isDeleted: false,
} as StorageObject;

describe('StorageObjectDeleteOneUseCase', () => {
  let repository: {
    withTreeLock: jest.Mock;
    getOne: jest.Mock;
    markDeletedWithDescendants: jest.Mock;
  };
  let useCase: StorageObjectDeleteOneUseCase;

  beforeEach(() => {
    repository = {
      withTreeLock: jest.fn((_userId: string, work: () => Promise<unknown>) => work()),
      getOne: jest.fn().mockResolvedValue(right(folder)),
      markDeletedWithDescendants: jest.fn().mockResolvedValue(right(3)),
    };

    useCase = new StorageObjectDeleteOneUseCase(repository as unknown as StorageObjectRepository);
  });

  // No emptiness check: a folder goes with its content, which the crons remove afterwards.
  it('marks a folder with everything under it', async () => {
    const result = await useCase.execute({ id: folder.id });

    expect(result.isRight() && result.value).toBe(folder);
    expect(repository.markDeletedWithDescendants).toHaveBeenCalledWith(folder.id);
  });

  it('looks only among objects that are not deleted yet', async () => {
    await useCase.execute({ id: folder.id });

    expect(repository.getOne).toHaveBeenCalledWith({ id: folder.id, isDeleted: false });
  });

  it('refuses the root folder', async () => {
    repository.getOne.mockResolvedValue(right({ ...folder, parentId: undefined }));

    const result = await useCase.execute({ id: folder.id });

    expect(result.isLeft() && result.value).toBeInstanceOf(BadRequestException);
    expect(repository.markDeletedWithDescendants).not.toHaveBeenCalled();
  });

  it('accepts a leaf placed in the root', async () => {
    repository.getOne.mockResolvedValue(
      right({ ...folder, isFolder: false, type: NestStorage.StorageObjectType.FILE }),
    );

    expect((await useCase.execute({ id: folder.id })).isRight()).toBe(true);
  });

  it('reports a missing object as not found', async () => {
    repository.getOne.mockResolvedValue(left(new NotFoundException()));

    const result = await useCase.execute({ id: 'missing' });

    expect(result.isLeft() && result.value).toBeInstanceOf(NotFoundException);
    expect(repository.markDeletedWithDescendants).not.toHaveBeenCalled();
  });

  // A move could otherwise take an object out of the subtree, or put one in, between the read of the
  // subtree and the mark; a create could place a live object in a folder being marked. The read
  // before the lock only names whose tree to lock.
  it('marks only inside the owner’s tree lock', async () => {
    const failure = new Error('connection lost');
    repository.withTreeLock.mockResolvedValue(left(failure));

    const result = await useCase.execute({ id: folder.id });

    expect(result.isLeft() && result.value).toBe(failure);
    expect(repository.withTreeLock).toHaveBeenCalledWith('owner', expect.any(Function));
    expect(repository.getOne).toHaveBeenCalledTimes(1);
    expect(repository.markDeletedWithDescendants).not.toHaveBeenCalled();
  });

  it('reports a failed mark as a server error', async () => {
    repository.markDeletedWithDescendants.mockResolvedValue(left(new Error('deadlock')));

    const result = await useCase.execute({ id: folder.id });

    expect(result.isLeft() && result.value).toBeInstanceOf(InternalServerErrorException);
  });
});
