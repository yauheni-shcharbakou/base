import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { NestStorage } from '@backend/proto';
import { StorageObjectValidationService } from '@modules/storage-object/application/services/storage-object.validation.service';
import {
  StorageObjectCreate,
  StorageObjectRepository,
} from '@modules/storage-object/domain/repositories/storage-object.repository';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import { StorageObjectCreateFoldersUseCase } from './storage-object.create-folders.use-case';

describe('StorageObjectCreateFoldersUseCase', () => {
  let repository: { withTreeLock: Mock; saveMany: Mock };
  let validation: { validatePlacement: Mock; resolveFreeName: Mock };
  let useCase: StorageObjectCreateFoldersUseCase;

  const create = (paths: string[]) => useCase.execute({ userId: 'owner', parent: 'target', paths });

  beforeEach(() => {
    let nextId = 0;

    repository = {
      withTreeLock: vi.fn((_userId: string, work: () => Promise<unknown>) => work()),
      // Each saved row gets an id, as `pgId` gives it when the entity is built.
      saveMany: vi.fn((rows: StorageObjectCreate[]) =>
        Promise.resolve(right(rows.map((row) => ({ ...row, id: `id-${(nextId += 1)}` })))),
      ),
    };
    validation = {
      validatePlacement: vi.fn().mockResolvedValue(right({ isPublic: false })),
      resolveFreeName: vi.fn(({ name }: { name: string }) => Promise.resolve(name)),
    };

    useCase = new StorageObjectCreateFoldersUseCase(
      repository as unknown as StorageObjectRepository,
      validation as unknown as StorageObjectValidationService,
    );
  });

  it('saves the tree a level at a time, each folder under the one above it', async () => {
    const result = await create(['img/2024/may', 'img', 'img/2024', 'docs']);

    expect(repository.withTreeLock).toHaveBeenCalledWith('owner', expect.any(Function));
    expect(validation.validatePlacement).toHaveBeenCalledWith('target', 'owner');

    const levels = repository.saveMany.mock.calls.map(([rows]: [StorageObjectCreate[]]) =>
      rows.map(({ name, parent }) => `${parent}/${name}`),
    );

    expect(levels).toEqual([['target/img', 'target/docs'], ['id-1/2024'], ['id-3/may']]);

    const folders = result.isRight() ? result.value : [];

    // In `paths` order, whatever order they were saved in.
    expect(folders.map(({ name }) => name)).toEqual(['may', 'img', '2024', 'docs']);
    expect(
      folders.every(
        ({ isFolder, type }) => isFolder && type === NestStorage.StorageObjectType.FOLDER,
      ),
    ).toBe(true);
  });

  it('suffixes a top-level name taken in the target, and only a top-level one', async () => {
    validation.resolveFreeName.mockImplementation(({ name }: { name: string }) =>
      Promise.resolve(`${name} (1)`),
    );

    const result = await create(['img', 'img/2024']);

    expect(validation.resolveFreeName).toHaveBeenCalledTimes(1);
    expect(validation.resolveFreeName).toHaveBeenCalledWith(
      { userId: 'owner', parent: 'target', name: 'img', isFolder: true },
      expect.any(Set),
    );
    expect(result.isRight() && result.value.map(({ name }) => name)).toEqual(['img (1)', '2024']);
  });

  it('keeps two top-level folders of the batch from taking the same free name', async () => {
    await create(['a', 'b']);

    const reserved = validation.resolveFreeName.mock.calls[1][1] as Set<string>;

    expect(reserved.has('a')).toBe(true);
  });

  it('makes the folders public under a public target', async () => {
    validation.validatePlacement.mockResolvedValue(right({ isPublic: true }));

    const result = await create(['img']);

    expect(result.isRight() && result.value[0].isPublic).toBe(true);
  });

  it.each([[[] as string[]], [['img', 'img']], [['img//a']], [['img/2024']]])(
    'refuses a tree that is not whole: %j',
    async (paths) => {
      const result = await create(paths);

      expect(result.isLeft() && result.value).toBeInstanceOf(BadRequestException);
      expect(repository.withTreeLock).not.toHaveBeenCalled();
    },
  );

  it('writes nothing when the target is not a folder of the owner', async () => {
    validation.validatePlacement.mockResolvedValue(left(new NotFoundException()));

    const result = await create(['img']);

    expect(result.isLeft() && result.value).toBeInstanceOf(NotFoundException);
    expect(repository.saveMany).not.toHaveBeenCalled();
  });

  // The lock's transaction rolls back on a `left`, so the levels saved before it go back too.
  it('stops at the first failed save and returns it', async () => {
    const failure = new Error('write failed');
    repository.saveMany.mockResolvedValueOnce(right([{ id: 'id-1' }]));
    repository.saveMany.mockResolvedValueOnce(left(failure));

    const result = await create(['img', 'img/2024', 'img/2024/may']);

    expect(result.isLeft() && result.value).toBe(failure);
    expect(repository.saveMany).toHaveBeenCalledTimes(2);
  });
});
