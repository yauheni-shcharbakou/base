import { NestStorage } from '@backend/proto';
import { StorageObjectValidationService } from '@modules/storage-object/application/services/storage-object.validation.service';
import { StorageObject } from '@modules/storage-object/domain/entities/storage-object.interface';
import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import { StorageObjectUpdateOneUseCase } from './storage-object.update-one.use-case';

const folder = {
  id: 'folder-1',
  name: 'docs',
  isFolder: true,
  isPublic: false,
  parentId: 'root',
  type: NestStorage.StorageObjectType.FOLDER,
  isDeleted: false,
} as StorageObject;

const byId = (id: string): NestStorage.StorageObjectQuery => ({ id, ids: [] });

describe('StorageObjectUpdateOneUseCase', () => {
  let repository: {
    withTreeLock: jest.Mock;
    getOne: jest.Mock;
    getAllChildrenIds: jest.Mock;
    updateAndCascadePublic: jest.Mock;
  };
  let validation: { validatePlacement: jest.Mock; validateObjectName: jest.Mock };
  let useCase: StorageObjectUpdateOneUseCase;

  beforeEach(() => {
    repository = {
      withTreeLock: jest.fn((work: () => Promise<unknown>) => work()),
      getOne: jest.fn().mockResolvedValue(right(folder)),
      getAllChildrenIds: jest.fn().mockResolvedValue(right(new Set(['child-folder']))),
      updateAndCascadePublic: jest.fn().mockResolvedValue(right(folder)),
    };

    validation = {
      validatePlacement: jest.fn().mockResolvedValue(right({ isPublic: true })),
      validateObjectName: jest.fn(),
    };

    useCase = new StorageObjectUpdateOneUseCase(
      repository as unknown as StorageObjectRepository,
      validation as unknown as StorageObjectValidationService,
    );
  });

  // The object takes the visibility of its new parent; the repository spreads it over the subtree.
  it('moves an object under the new parent with the parent’s visibility', async () => {
    const result = await useCase.execute(byId(folder.id), { set: { parent: 'target' } });

    expect(result.isRight()).toBe(true);
    expect(validation.validatePlacement).toHaveBeenCalledWith('target', folder.id);
    expect(repository.updateAndCascadePublic).toHaveBeenCalledWith(folder.id, {
      set: { parent: 'target', isPublic: true },
    });
  });

  it('passes a visibility toggle through to the cascading write', async () => {
    await useCase.execute(byId(folder.id), { set: { isPublic: true } });

    expect(validation.validatePlacement).not.toHaveBeenCalled();
    expect(repository.updateAndCascadePublic).toHaveBeenCalledWith(folder.id, {
      set: { isPublic: true },
    });
  });

  // A folder moved into its own subtree would detach it from the root and close a cycle.
  it('refuses to move a folder under one of its descendants', async () => {
    const result = await useCase.execute(byId(folder.id), { set: { parent: 'child-folder' } });

    expect(result.isLeft() && result.value).toBeInstanceOf(BadRequestException);
    expect(repository.updateAndCascadePublic).not.toHaveBeenCalled();
  });

  // An empty set would read as "no descendants" and let the folder into its own subtree.
  it('refuses the move when the descendant walk fails', async () => {
    const failure = new Error('connection lost');
    repository.getAllChildrenIds.mockResolvedValue(left(failure));

    const result = await useCase.execute(byId(folder.id), { set: { parent: 'target' } });

    expect(result.isLeft() && result.value).toBe(failure);
    expect(validation.validatePlacement).not.toHaveBeenCalled();
    expect(repository.updateAndCascadePublic).not.toHaveBeenCalled();
  });

  // Two opposite moves checked outside it would both pass and close a cycle together.
  it('reads, checks and writes only inside the tree lock', async () => {
    const failure = new Error('connection lost');
    repository.withTreeLock.mockResolvedValue(left(failure));

    const result = await useCase.execute(byId(folder.id), { set: { parent: 'target' } });

    expect(result.isLeft() && result.value).toBe(failure);
    expect(repository.getOne).not.toHaveBeenCalled();
    expect(repository.getAllChildrenIds).not.toHaveBeenCalled();
    expect(validation.validatePlacement).not.toHaveBeenCalled();
    expect(repository.updateAndCascadePublic).not.toHaveBeenCalled();
  });

  it('writes nothing when the new parent is not a valid placement', async () => {
    validation.validatePlacement.mockResolvedValue(left(new NotFoundException()));

    const result = await useCase.execute(byId(folder.id), { set: { parent: 'missing' } });

    expect(result.isLeft() && result.value).toBeInstanceOf(NotFoundException);
    expect(repository.updateAndCascadePublic).not.toHaveBeenCalled();
  });

  it('reports a missing object as not found', async () => {
    repository.getOne.mockResolvedValue(left(new NotFoundException()));

    const result = await useCase.execute(byId('missing'), { set: { isPublic: true } });

    expect(result.isLeft() && result.value).toBeInstanceOf(NotFoundException);
    expect(repository.updateAndCascadePublic).not.toHaveBeenCalled();
  });
});
