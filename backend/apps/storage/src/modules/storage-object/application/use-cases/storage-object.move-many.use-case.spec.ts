import { NestStorage } from '@backend/proto';
import { StorageObjectValidationService } from '@modules/storage-object/application/services/storage-object.validation.service';
import { StorageObject } from '@modules/storage-object/domain/entities/storage-object.interface';
import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import { StorageObjectMoveManyUseCase } from './storage-object.move-many.use-case';

const folder = {
  id: 'folder-1',
  userId: 'owner',
  name: 'docs',
  isFolder: true,
  parentId: 'root',
  type: NestStorage.StorageObjectType.FOLDER,
} as StorageObject;

const file = {
  id: 'file-1',
  userId: 'owner',
  name: 'a.txt',
  isFolder: false,
  parentId: 'root',
  type: NestStorage.StorageObjectType.FILE,
} as StorageObject;

describe('StorageObjectMoveManyUseCase', () => {
  let repository: {
    withTreeLock: jest.Mock;
    getAllChildrenIds: jest.Mock;
    updateAndCascadePublic: jest.Mock;
  };
  let validation: {
    validateBatch: jest.Mock;
    validatePlacement: jest.Mock;
    resolveFreeName: jest.Mock;
  };
  let useCase: StorageObjectMoveManyUseCase;

  beforeEach(() => {
    repository = {
      withTreeLock: jest.fn((_userId: string, work: () => Promise<unknown>) => work()),
      getAllChildrenIds: jest.fn().mockResolvedValue(right(new Set(['child-folder']))),
      updateAndCascadePublic: jest.fn((id: string) => Promise.resolve(right({ id }))),
    };
    validation = {
      validateBatch: jest.fn().mockResolvedValue(right([folder, file])),
      validatePlacement: jest.fn().mockResolvedValue(right({ isPublic: true })),
      resolveFreeName: jest.fn(({ name }: { name: string }) => Promise.resolve(name)),
    };

    useCase = new StorageObjectMoveManyUseCase(
      repository as unknown as StorageObjectRepository,
      validation as unknown as StorageObjectValidationService,
    );
  });

  it('moves every object under the target with the target’s visibility, in order', async () => {
    const result = await useCase.execute({ ids: [folder.id, file.id], parent: 'target' });

    expect(result.isRight()).toBe(true);
    expect(repository.withTreeLock).toHaveBeenCalledWith('owner', expect.any(Function));
    expect(validation.validatePlacement).toHaveBeenCalledWith('target', 'owner');
    expect(repository.updateAndCascadePublic.mock.calls).toEqual([
      [folder.id, { set: { parent: 'target', isPublic: true } }],
      [file.id, { set: { parent: 'target', isPublic: true } }],
    ]);
  });

  it('suffixes a name taken in the target, a folder’s and a file’s alike', async () => {
    validation.resolveFreeName.mockImplementation(({ name }: { name: string }) =>
      Promise.resolve(name === 'docs' ? 'docs (1)' : 'a (1).txt'),
    );

    await useCase.execute({ ids: [folder.id, file.id], parent: 'target' });

    expect(validation.resolveFreeName).toHaveBeenCalledWith({
      id: folder.id,
      userId: 'owner',
      name: 'docs',
      parent: 'target',
      isFolder: true,
    });
    expect(repository.updateAndCascadePublic).toHaveBeenCalledWith(folder.id, {
      set: { parent: 'target', isPublic: true, name: 'docs (1)' },
    });
    expect(repository.updateAndCascadePublic).toHaveBeenCalledWith(file.id, {
      set: { parent: 'target', isPublic: true, name: 'a (1).txt' },
    });
  });

  it('leaves an object already in the target as it is', async () => {
    const result = await useCase.execute({ ids: [folder.id, file.id], parent: 'root' });

    expect(result.isRight() && result.value).toEqual([folder, file]);
    expect(repository.updateAndCascadePublic).not.toHaveBeenCalled();
  });

  it('refuses a target under one of the moved folders', async () => {
    const result = await useCase.execute({ ids: [folder.id, file.id], parent: 'child-folder' });

    expect(result.isLeft() && result.value).toBeInstanceOf(BadRequestException);
    expect(repository.updateAndCascadePublic).not.toHaveBeenCalled();
  });

  it('refuses a target that is one of the moved folders', async () => {
    const result = await useCase.execute({ ids: [folder.id], parent: folder.id });

    expect(result.isLeft() && result.value).toBeInstanceOf(BadRequestException);
    expect(repository.updateAndCascadePublic).not.toHaveBeenCalled();
  });

  // An empty set would read as "no descendants" and let a folder into its own subtree.
  it('refuses the move when a descendant walk fails', async () => {
    const failure = new Error('connection lost');
    repository.getAllChildrenIds.mockResolvedValue(left(failure));

    const result = await useCase.execute({ ids: [folder.id], parent: 'target' });

    expect(result.isLeft() && result.value).toBe(failure);
    expect(repository.updateAndCascadePublic).not.toHaveBeenCalled();
  });

  it('writes nothing when the target is not a folder of the owner', async () => {
    validation.validatePlacement.mockResolvedValue(left(new NotFoundException()));

    const result = await useCase.execute({ ids: [folder.id], parent: 'foreign' });

    expect(result.isLeft() && result.value).toBeInstanceOf(NotFoundException);
    expect(repository.updateAndCascadePublic).not.toHaveBeenCalled();
  });

  // The lock's transaction rolls back on a `left`, so the objects written before it go back too.
  it('stops at the first failed write and returns it', async () => {
    const failure = new Error('write failed');
    repository.updateAndCascadePublic.mockResolvedValueOnce(left(failure));

    const result = await useCase.execute({ ids: [folder.id, file.id], parent: 'target' });

    expect(result.isLeft() && result.value).toBe(failure);
    expect(repository.updateAndCascadePublic).toHaveBeenCalledTimes(1);
  });

  it('moves nothing when an object is missing, without taking a lock', async () => {
    validation.validateBatch.mockResolvedValue(left(new NotFoundException()));

    const result = await useCase.execute({ ids: ['missing'], parent: 'target' });

    expect(result.isLeft() && result.value).toBeInstanceOf(NotFoundException);
    expect(repository.withTreeLock).not.toHaveBeenCalled();
  });
});
