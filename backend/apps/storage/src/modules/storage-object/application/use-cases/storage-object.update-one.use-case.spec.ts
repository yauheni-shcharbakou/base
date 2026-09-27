import { NestStorage } from '@backend/proto';
import { StorageObjectValidationService } from '@modules/storage-object/application/services/storage-object.validation.service';
import { StorageObject } from '@modules/storage-object/domain/entities/storage-object.interface';
import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import { StorageObjectUpdateOneUseCase } from './storage-object.update-one.use-case';

const folder = {
  id: 'folder-1',
  userId: 'owner',
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
  let validation: { validatePlacement: jest.Mock; validateNameIsFree: jest.Mock };
  let useCase: StorageObjectUpdateOneUseCase;

  beforeEach(() => {
    repository = {
      withTreeLock: jest.fn((_userId: string, work: () => Promise<unknown>) => work()),
      getOne: jest.fn().mockResolvedValue(right(folder)),
      getAllChildrenIds: jest.fn().mockResolvedValue(right(new Set(['child-folder']))),
      updateAndCascadePublic: jest.fn().mockResolvedValue(right(folder)),
    };

    validation = {
      validatePlacement: jest.fn().mockResolvedValue(right({ isPublic: true })),
      validateNameIsFree: jest.fn(({ name }: { name: string }) => Promise.resolve(right(name))),
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
    expect(validation.validatePlacement).toHaveBeenCalledWith('target', 'owner', folder.id);
    expect(repository.updateAndCascadePublic).toHaveBeenCalledWith(folder.id, {
      set: { parent: 'target', isPublic: true },
    });
  });

  it('passes a visibility toggle through to the cascading write', async () => {
    await useCase.execute(byId(folder.id), { set: { isPublic: true } });

    expect(validation.validatePlacement).not.toHaveBeenCalled();
    expect(validation.validateNameIsFree).not.toHaveBeenCalled();
    expect(repository.updateAndCascadePublic).toHaveBeenCalledWith(folder.id, {
      set: { isPublic: true },
    });
  });

  describe('name', () => {
    // The new name, checked in the folder the object stays in, with the object itself left out —
    // checking the current name would find the object and refuse every folder rename.
    it('renames after checking the new name in the same folder', async () => {
      const result = await useCase.execute(byId(folder.id), { set: { name: 'papers' } });

      expect(result.isRight()).toBe(true);
      expect(validation.validateNameIsFree).toHaveBeenCalledWith({
        id: folder.id,
        userId: 'owner',
        name: 'papers',
        parent: folder.parentId,
      });
      expect(repository.updateAndCascadePublic).toHaveBeenCalledWith(folder.id, {
        set: { name: 'papers' },
      });
    });

    it('checks the unchanged name in the target folder on a move', async () => {
      await useCase.execute(byId(folder.id), { set: { parent: 'target' } });

      expect(validation.validateNameIsFree).toHaveBeenCalledWith({
        id: folder.id,
        userId: 'owner',
        name: folder.name,
        parent: 'target',
      });
    });

    it('checks the new name in the target folder on a rename with a move', async () => {
      await useCase.execute(byId(folder.id), { set: { name: 'papers', parent: 'target' } });

      expect(validation.validateNameIsFree).toHaveBeenCalledWith({
        id: folder.id,
        userId: 'owner',
        name: 'papers',
        parent: 'target',
      });
      expect(repository.updateAndCascadePublic).toHaveBeenCalledWith(folder.id, {
        set: { name: 'papers', parent: 'target', isPublic: true },
      });
    });

    // Refused, not suffixed, for a file as for a folder: an edit applies the name it was given.
    it('refuses a taken name and writes nothing', async () => {
      const file = { ...folder, name: 'a.txt', isFolder: false } as StorageObject;
      repository.getOne.mockResolvedValue(right(file));
      validation.validateNameIsFree.mockResolvedValue(left(new ConflictException()));

      const result = await useCase.execute(byId(file.id), { set: { name: 'b.txt' } });

      expect(result.isLeft() && result.value).toBeInstanceOf(ConflictException);
      expect(validation.validateNameIsFree).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'b.txt' }),
      );
      expect(repository.updateAndCascadePublic).not.toHaveBeenCalled();
    });

    // An edit form sends its fields back as they are; an existing duplicate must not block it.
    it('checks nothing and writes no name when neither the name nor the folder changes', async () => {
      await useCase.execute(byId(folder.id), {
        set: { name: folder.name, isPublic: true },
      });

      expect(validation.validateNameIsFree).not.toHaveBeenCalled();
      expect(repository.updateAndCascadePublic).toHaveBeenCalledWith(folder.id, {
        set: { isPublic: true },
      });
    });

    it('renames a root folder without a check, as it has no folder to clash in', async () => {
      repository.getOne.mockResolvedValue(right({ ...folder, parentId: undefined }));

      await useCase.execute(byId(folder.id), { set: { name: 'home' } });

      expect(validation.validateNameIsFree).not.toHaveBeenCalled();
      expect(repository.updateAndCascadePublic).toHaveBeenCalledWith(folder.id, {
        set: { name: 'home' },
      });
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

  // Two opposite moves checked outside it would both pass and close a cycle together. The one read
  // before it only names whose tree to lock; the owner never changes, so it cannot go stale.
  it('checks and writes only inside the owner’s tree lock', async () => {
    const failure = new Error('connection lost');
    repository.withTreeLock.mockResolvedValue(left(failure));

    const result = await useCase.execute(byId(folder.id), { set: { parent: 'target' } });

    expect(result.isLeft() && result.value).toBe(failure);
    expect(repository.withTreeLock).toHaveBeenCalledWith('owner', expect.any(Function));
    expect(repository.getOne).toHaveBeenCalledTimes(1);
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

  it('reports a missing object as not found, without taking a lock', async () => {
    repository.getOne.mockResolvedValue(left(new NotFoundException()));

    const result = await useCase.execute(byId('missing'), { set: { isPublic: true } });

    expect(result.isLeft() && result.value).toBeInstanceOf(NotFoundException);
    expect(repository.withTreeLock).not.toHaveBeenCalled();
    expect(repository.updateAndCascadePublic).not.toHaveBeenCalled();
  });

  // A deleted object waits for the cleanup; moving it back into a live folder would not revive it.
  it('looks only among objects that are not deleted', async () => {
    await useCase.execute(byId(folder.id), { set: { name: 'papers' } });

    expect(repository.getOne).toHaveBeenCalledTimes(2);
    expect(repository.getOne).toHaveBeenNthCalledWith(1, { ...byId(folder.id), isDeleted: false });
    expect(repository.getOne).toHaveBeenNthCalledWith(2, { ...byId(folder.id), isDeleted: false });
  });
});
