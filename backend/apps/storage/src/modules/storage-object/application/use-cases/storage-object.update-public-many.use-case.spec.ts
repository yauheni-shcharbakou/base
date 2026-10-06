import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { NestStorage } from '@backend/proto';
import { StorageObjectValidationService } from '@modules/storage-object/application/services/storage-object.validation.service';
import { StorageObject } from '@modules/storage-object/domain/entities/storage-object.interface';
import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import { StorageObjectUpdatePublicManyUseCase } from './storage-object.update-public-many.use-case';

const folder = {
  id: 'folder-1',
  userId: 'owner',
  name: 'docs',
  isFolder: true,
  isPublic: false,
  parentId: 'root',
  type: NestStorage.StorageObjectType.FOLDER,
} as StorageObject;

const file = {
  id: 'file-1',
  userId: 'owner',
  name: 'a.txt',
  isFolder: false,
  isPublic: true,
  parentId: 'root',
  type: NestStorage.StorageObjectType.FILE,
} as StorageObject;

describe('StorageObjectUpdatePublicManyUseCase', () => {
  let repository: {
    withTreeLock: Mock;
    updateAndCascadePublic: Mock;
  };
  let validation: {
    validateBatch: Mock;
    validateVisibility: Mock;
  };
  let useCase: StorageObjectUpdatePublicManyUseCase;

  beforeEach(() => {
    repository = {
      withTreeLock: vi.fn((_userId: string, work: () => Promise<unknown>) => work()),
      updateAndCascadePublic: vi.fn((id: string) => Promise.resolve(right({ id }))),
    };
    validation = {
      validateBatch: vi.fn().mockResolvedValue(right([folder, file])),
      validateVisibility: vi.fn().mockResolvedValue(right(undefined)),
    };

    useCase = new StorageObjectUpdatePublicManyUseCase(
      repository as unknown as StorageObjectRepository,
      validation as unknown as StorageObjectValidationService,
    );
  });

  it('writes the value over the objects that differ, under the owner’s tree lock', async () => {
    const result = await useCase.execute({ ids: [folder.id, file.id], isPublic: true });

    expect(repository.withTreeLock).toHaveBeenCalledWith('owner', expect.any(Function));
    expect(repository.updateAndCascadePublic.mock.calls).toEqual([
      [folder.id, { set: { isPublic: true } }],
    ]);
    // In the order given; the one that had the value already comes back as it was.
    expect(result.isRight() && result.value).toEqual([{ id: folder.id }, file]);
  });

  it('checks the folders of the objects before making them private', async () => {
    await useCase.execute({ ids: [folder.id, file.id], isPublic: false });

    expect(validation.validateVisibility).toHaveBeenCalledWith([folder, file], false);
    expect(repository.updateAndCascadePublic.mock.calls).toEqual([
      [file.id, { set: { isPublic: false } }],
    ]);
  });

  it('writes nothing when an object sits in a public folder', async () => {
    const refusal = new BadRequestException('An object in a public folder is public too');
    validation.validateVisibility.mockResolvedValue(left(refusal));

    const result = await useCase.execute({ ids: [folder.id, file.id], isPublic: false });

    expect(result.isLeft() && result.value).toBe(refusal);
    expect(repository.updateAndCascadePublic).not.toHaveBeenCalled();
  });

  it('passes the caller’s owner scope to the batch read', async () => {
    await useCase.execute({ ids: [folder.id], isPublic: true, userId: 'owner' });

    expect(validation.validateBatch).toHaveBeenCalledWith([folder.id], 'owner');
  });

  it('reports a missing object without taking a lock', async () => {
    const missing = new NotFoundException('Storage object not found');
    validation.validateBatch.mockResolvedValue(left(missing));

    const result = await useCase.execute({ ids: ['missing'], isPublic: true });

    expect(result.isLeft() && result.value).toBe(missing);
    expect(repository.withTreeLock).not.toHaveBeenCalled();
  });

  // The lock rolls back what was written before the failure.
  it('stops at the first failed write and returns it', async () => {
    const failure = new Error('connection lost');
    repository.updateAndCascadePublic.mockResolvedValue(left(failure));

    const result = await useCase.execute({ ids: [folder.id, file.id], isPublic: false });

    expect(result.isLeft() && result.value).toBe(failure);
    expect(repository.updateAndCascadePublic).toHaveBeenCalledTimes(1);
  });
});
