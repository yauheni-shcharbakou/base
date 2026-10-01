import { NestStorage } from '@backend/proto';
import { StorageObjectValidationService } from '@modules/storage-object/application/services/storage-object.validation.service';
import { StorageObject } from '@modules/storage-object/domain/entities/storage-object.interface';
import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import { StorageObjectDeleteManyUseCase } from './storage-object.delete-many.use-case';

const folder = {
  id: 'folder-1',
  userId: 'owner',
  isFolder: true,
  parentId: 'root',
  type: NestStorage.StorageObjectType.FOLDER,
} as StorageObject;

const file = {
  id: 'file-1',
  userId: 'owner',
  isFolder: false,
  parentId: 'root',
  type: NestStorage.StorageObjectType.FILE,
} as StorageObject;

describe('StorageObjectDeleteManyUseCase', () => {
  let repository: { withTreeLock: jest.Mock; markManyDeletedWithDescendants: jest.Mock };
  let validation: { validateBatch: jest.Mock };
  let useCase: StorageObjectDeleteManyUseCase;

  beforeEach(() => {
    repository = {
      withTreeLock: jest.fn((_userId: string, work: () => Promise<unknown>) => work()),
      markManyDeletedWithDescendants: jest.fn().mockResolvedValue(right(5)),
    };
    validation = { validateBatch: jest.fn().mockResolvedValue(right([folder, file])) };

    useCase = new StorageObjectDeleteManyUseCase(
      repository as unknown as StorageObjectRepository,
      validation as unknown as StorageObjectValidationService,
    );
  });

  it('marks every object with its subtree in one call, under the owner’s lock', async () => {
    const result = await useCase.execute({ ids: [folder.id, file.id] });

    expect(result.isRight() && result.value).toEqual([folder, file]);
    expect(repository.withTreeLock).toHaveBeenCalledWith('owner', expect.any(Function));
    expect(repository.markManyDeletedWithDescendants).toHaveBeenCalledWith([folder.id, file.id]);
  });

  // Once to learn whose tree to lock, once more inside the lock, where the answer holds.
  it('reads the batch again inside the lock, scoped to the caller’s owner', async () => {
    await useCase.execute({ ids: [folder.id], userId: 'owner' });

    expect(validation.validateBatch).toHaveBeenCalledTimes(2);
    expect(validation.validateBatch).toHaveBeenNthCalledWith(2, [folder.id], 'owner');
  });

  it('deletes nothing when an object is missing, without taking a lock', async () => {
    validation.validateBatch.mockResolvedValue(left(new NotFoundException()));

    const result = await useCase.execute({ ids: [folder.id, 'missing'] });

    expect(result.isLeft() && result.value).toBeInstanceOf(NotFoundException);
    expect(repository.withTreeLock).not.toHaveBeenCalled();
    expect(repository.markManyDeletedWithDescendants).not.toHaveBeenCalled();
  });

  it('deletes nothing when the root folder is among the objects', async () => {
    validation.validateBatch.mockResolvedValue(right([file, { ...folder, parentId: undefined }]));

    const result = await useCase.execute({ ids: [file.id, folder.id] });

    expect(result.isLeft() && result.value).toBeInstanceOf(BadRequestException);
    expect(repository.markManyDeletedWithDescendants).not.toHaveBeenCalled();
  });

  it('reports a failed mark as a server error', async () => {
    repository.markManyDeletedWithDescendants.mockResolvedValue(left(new Error('lost')));

    const result = await useCase.execute({ ids: [folder.id] });

    expect(result.isLeft() && result.value).toBeInstanceOf(InternalServerErrorException);
  });
});
