import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { NestStorage } from '@backend/proto';
import {
  StorageObjectMedia,
  StorageObjectRepository,
} from '@modules/storage-object/domain/repositories/storage-object.repository';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import {
  resolveIsPublic,
  StorageObjectValidationService,
} from './storage-object.validation.service';

describe('StorageObjectValidationService', () => {
  let repository: {
    isExists: Mock;
    distinct: Mock;
    getOne: Mock;
    getMany: Mock;
    getMediaToPlace: Mock;
  };
  let service: StorageObjectValidationService;

  beforeEach(() => {
    repository = {
      isExists: vi.fn().mockResolvedValue(false),
      distinct: vi.fn().mockResolvedValue(new Set()),
      getOne: vi.fn().mockResolvedValue(right({ id: 'root', isPublic: true })),
      getMany: vi.fn().mockResolvedValue([]),
      getMediaToPlace: vi.fn(),
    };

    service = new StorageObjectValidationService(repository as unknown as StorageObjectRepository);
  });

  describe('validateNameIsFree', () => {
    const target = { id: 'moved', userId: 'owner', name: 'docs', parent: 'target' };

    // Any live sibling takes a name — a folder's and a file's alike — with the object itself left
    // out, as it never clashes with its own name.
    it('looks for any other live object of that name in the target folder', async () => {
      const result = await service.validateNameIsFree(target);

      expect(result.isRight() && result.value).toBe('docs');
      expect(repository.isExists).toHaveBeenCalledWith({
        userId: 'owner',
        parent: 'target',
        name: 'docs',
        isDeleted: false,
        excludeIds: ['moved'],
      });
    });

    // A 409, so a client can put it on the name field rather than guess among the call's 400s.
    it('refuses a taken name as a conflict', async () => {
      repository.isExists.mockResolvedValue(true);

      const result = await service.validateNameIsFree(target);

      expect(result.isLeft() && result.value).toBeInstanceOf(ConflictException);
    });
  });

  describe('validateObjectName', () => {
    // A file of the same name takes a folder's name as much as another folder does. A deleted
    // object is hidden and only waits for the cleanup crons; its name is free already.
    it('checks a new folder’s name against every live sibling', async () => {
      const result = await service.validateObjectName({
        name: 'docs',
        type: NestStorage.StorageObjectType.FOLDER,
        parent: 'root',
        userId: 'owner',
      });

      expect(result.isRight() && result.value).toBe('docs');
      expect(repository.isExists).toHaveBeenCalledWith({
        userId: 'owner',
        parent: 'root',
        name: 'docs',
        isDeleted: false,
      });
    });

    it('refuses a folder name a file already holds', async () => {
      repository.isExists.mockResolvedValue(true);

      const result = await service.validateObjectName({
        name: 'docs',
        type: NestStorage.StorageObjectType.FOLDER,
        parent: 'root',
        userId: 'owner',
      });

      expect(result.isLeft() && result.value).toBeInstanceOf(ConflictException);
    });

    it('suffixes a taken file name past the live siblings only', async () => {
      repository.distinct.mockResolvedValue(new Set(['a.txt', 'a (1).txt']));

      const result = await service.validateObjectName({
        name: 'a.txt',
        type: NestStorage.StorageObjectType.FILE,
        parent: 'root',
        userId: 'owner',
      });

      expect(result.isRight() && result.value).toBe('a (2).txt');
      expect(repository.distinct).toHaveBeenCalledWith('name', {
        userId: 'owner',
        parent: 'root',
        nameStartsWith: 'a',
        isDeleted: false,
      });
    });
  });
  describe('resolveFreeName', () => {
    const target = { id: 'moved', userId: 'owner', parent: 'target' };

    it('keeps a name that is free, the object itself left out of the siblings', async () => {
      const name = await service.resolveFreeName({ ...target, name: 'a.txt', isFolder: false });

      expect(name).toBe('a.txt');
      expect(repository.distinct).toHaveBeenCalledWith('name', {
        userId: 'owner',
        parent: 'target',
        nameStartsWith: 'a',
        isDeleted: false,
        excludeIds: ['moved'],
      });
    });

    it('suffixes a file before its extension', async () => {
      repository.distinct.mockResolvedValue(new Set(['a.txt', 'a (1).txt']));

      const name = await service.resolveFreeName({ ...target, name: 'a.txt', isFolder: false });

      expect(name).toBe('a (2).txt');
    });

    // A dot in a folder's name is no extension: `v1.2` becomes `v1.2 (1)`, never `v1 (1).2`.
    it('suffixes a folder after its whole name', async () => {
      repository.distinct.mockResolvedValue(new Set(['v1.2']));

      const name = await service.resolveFreeName({ ...target, name: 'v1.2', isFolder: true });

      expect(name).toBe('v1.2 (1)');
      expect(repository.distinct).toHaveBeenCalledWith(
        'name',
        expect.objectContaining({ nameStartsWith: 'v1.2' }),
      );
    });

    it('suffixes past the names reserved by earlier items of the same call', async () => {
      const name = await service.resolveFreeName(
        { ...target, name: 'docs', isFolder: true },
        new Set(['docs']),
      );

      expect(name).toBe('docs (1)');
    });
  });

  describe('validateBatch', () => {
    const object = (id: string, userId = 'owner') => ({ id, userId });

    it('returns the live objects in the order they were named, each once', async () => {
      repository.getMany.mockResolvedValue([object('b'), object('a')]);

      const result = await service.validateBatch(['a', 'b', 'a'], 'owner');

      expect(result.isRight() && result.value.map(({ id }) => id)).toEqual(['a', 'b']);
      expect(repository.getMany).toHaveBeenCalledWith({
        ids: ['a', 'b'],
        userId: 'owner',
        isDeleted: false,
      });
    });

    // An empty `ids` filter constrains nothing: the query would read every object.
    it('refuses an empty batch without reading', async () => {
      const result = await service.validateBatch([]);

      expect(result.isLeft() && result.value).toBeInstanceOf(BadRequestException);
      expect(repository.getMany).not.toHaveBeenCalled();
    });

    it('reports a batch with a missing, deleted or foreign object as not found', async () => {
      repository.getMany.mockResolvedValue([object('a')]);

      const result = await service.validateBatch(['a', 'b']);

      expect(result.isLeft() && result.value).toBeInstanceOf(NotFoundException);
    });

    // The tree lock is per owner: a batch across two trees could not hold one.
    it('refuses objects of different owners', async () => {
      repository.getMany.mockResolvedValue([object('a'), object('b', 'other')]);

      const result = await service.validateBatch(['a', 'b']);

      expect(result.isLeft() && result.value).toBeInstanceOf(BadRequestException);
    });
  });

  describe('validateVisibility', () => {
    it('lets anything be made public without reading', async () => {
      const result = await service.validateVisibility([{ id: 'a', parentId: 'p' }], true);

      expect(result.isRight()).toBe(true);
      expect(repository.isExists).not.toHaveBeenCalled();
    });

    // A folder made private by the same call is no folder to follow; a root has none.
    it('looks for a public folder among the folders outside the set', async () => {
      const result = await service.validateVisibility(
        [
          { id: 'folder', parentId: 'p' },
          { id: 'child', parentId: 'folder' },
          { id: 'other', parentId: 'p' },
          { id: 'root', parentId: undefined },
        ],
        false,
      );

      expect(result.isRight()).toBe(true);
      expect(repository.isExists).toHaveBeenCalledWith({
        ids: ['p'],
        isPublic: true,
        isDeleted: false,
      });
    });

    it('refuses to make private an object whose folder is public', async () => {
      repository.isExists.mockResolvedValue(true);

      const result = await service.validateVisibility([{ id: 'a', parentId: 'p' }], false);

      expect(result.isLeft() && result.value).toBeInstanceOf(BadRequestException);
    });

    it('reads nothing when every folder is made private along with its content', async () => {
      const result = await service.validateVisibility(
        [
          { id: 'root', parentId: undefined },
          { id: 'child', parentId: 'root' },
        ],
        false,
      );

      expect(result.isRight()).toBe(true);
      expect(repository.isExists).not.toHaveBeenCalled();
    });
  });

  describe('validatePlacement', () => {
    it('looks the parent up among the owner’s live folders only', async () => {
      const result = await service.validatePlacement('root', 'owner');

      expect(result.isRight() && result.value).toEqual({ isPublic: true });
      expect(repository.getOne).toHaveBeenCalledWith({
        id: 'root',
        userId: 'owner',
        type: NestStorage.StorageObjectType.FOLDER,
        isDeleted: false,
      });
    });

    // Another user's folder, a deleted one and a missing one all come back the same way, so the
    // caller learns nothing about ids outside its own tree.
    it('reports a parent outside the owner’s live folders as not found', async () => {
      repository.getOne.mockResolvedValue(left(new NotFoundException()));

      const result = await service.validatePlacement('foreign', 'owner');

      expect(result.isLeft() && result.value).toBeInstanceOf(NotFoundException);
      expect(result.isLeft() && result.value.message).toBe('Parent folder not found');
    });

    it('refuses an object as its own parent without reading the tree', async () => {
      const result = await service.validatePlacement('moved', 'owner', 'moved');

      expect(result.isLeft() && result.value).toBeInstanceOf(BadRequestException);
      expect(repository.getOne).not.toHaveBeenCalled();
    });
  });

  // A public folder makes its content public; a private one leaves it to the caller, private by
  // default.
  describe('resolveIsPublic', () => {
    it.each([
      [true, true, true],
      [true, false, true],
      [true, undefined, true],
      [false, true, true],
      [false, false, false],
      [false, undefined, false],
    ])('parent %s, requested %s → %s', (parent, requested, expected) => {
      expect(resolveIsPublic(parent, requested)).toBe(expected);
    });
  });

  describe('validateLeaves', () => {
    const request = {
      userId: 'owner',
      parent: 'root',
      type: NestStorage.StorageObjectType.FILE,
    };

    it('makes a leaf public in a private folder when the caller asks', async () => {
      repository.getOne.mockResolvedValue(right({ id: 'root', isPublic: false }));

      const asked = await service.validateLeaves({ ...request, names: ['a.txt'], isPublic: true });
      const notAsked = await service.validateLeaves({ ...request, names: ['a.txt'] });

      expect(asked.isRight() && asked.value[0].isPublic).toBe(true);
      expect(notAsked.isRight() && notAsked.value[0].isPublic).toBe(false);
    });

    it('gives every leaf of a public folder its visibility, whatever the caller sent', async () => {
      const result = await service.validateLeaves({
        ...request,
        names: ['a.txt', 'b.txt'],
        isPublic: false,
      });

      expect(result.isRight() && result.value).toEqual([
        { parent: 'root', name: 'a.txt', isPublic: true },
        { parent: 'root', name: 'b.txt', isPublic: true },
      ]);
    });

    // `a.txt` is saved already; the batch asks for `a.txt` and `a (1).txt`. Suffixed one by one
    // against the database alone, both would come out as `a (1).txt`.
    it('suffixes a name past the names given to earlier items of the batch', async () => {
      repository.distinct.mockResolvedValue(new Set(['a.txt']));

      const result = await service.validateLeaves({ ...request, names: ['a (1).txt', 'a.txt'] });

      expect(result.isRight() && result.value.map(({ name }) => name)).toEqual([
        'a (1).txt',
        'a (2).txt',
      ]);
    });

    it('checks no name when the parent is refused', async () => {
      repository.getOne.mockResolvedValue(left(new NotFoundException()));

      const result = await service.validateLeaves({ ...request, names: ['a.txt'] });

      expect(result.isLeft() && result.value).toBeInstanceOf(NotFoundException);
      expect(repository.distinct).not.toHaveBeenCalled();
    });
  });

  describe('validateMedia', () => {
    const create = (
      type: NestStorage.StorageObjectType,
      media: Partial<Record<'file' | 'image' | 'video', string>> = {},
    ): NestStorage.StorageObjectCreate => ({
      name: 'object',
      isPublic: false,
      parent: 'root',
      userId: 'owner',
      type,
      ...media,
    });

    const media = (overrides: Partial<StorageObjectMedia> = {}) =>
      right<Error, StorageObjectMedia>({
        fileId: 'file-1',
        isPlaced: false,
        isBacking: false,
        uploadStatus: NestStorage.FileUploadStatus.READY,
        ...overrides,
      });

    beforeEach(() => {
      repository.getMediaToPlace.mockResolvedValue(media());
    });

    it('looks the media up among the owner’s own', async () => {
      const result = await service.validateMedia(
        create(NestStorage.StorageObjectType.IMAGE, { image: 'image-1' }),
      );

      expect(result.isRight() && result.value).toEqual({ file: 'file-1', image: 'image-1' });
      expect(repository.getMediaToPlace).toHaveBeenCalledWith({
        type: NestStorage.StorageObjectType.IMAGE,
        id: 'image-1',
        userId: 'owner',
      });
    });

    // Deleting the leaf would delete the media under it: another user's media reads as absent.
    it('reports media the owner does not hold as not found', async () => {
      repository.getMediaToPlace.mockResolvedValue(right(undefined));

      const result = await service.validateMedia(
        create(NestStorage.StorageObjectType.FILE, { file: 'foreign' }),
      );

      expect(result.isLeft() && result.value).toBeInstanceOf(NotFoundException);
      expect(result.isLeft() && result.value.message).toBe('File not found');
    });

    it('refuses media for a folder without reading it', async () => {
      const result = await service.validateMedia(
        create(NestStorage.StorageObjectType.FOLDER, { file: 'file-1' }),
      );

      expect(result.isLeft() && result.value).toBeInstanceOf(BadRequestException);
      expect(repository.getMediaToPlace).not.toHaveBeenCalled();
    });

    it('refuses a leaf without its media', async () => {
      const result = await service.validateMedia(
        create(NestStorage.StorageObjectType.VIDEO, { file: 'file-1' }),
      );

      expect(result.isLeft() && result.value).toBeInstanceOf(BadRequestException);
      expect(repository.getMediaToPlace).not.toHaveBeenCalled();
    });

    it('refuses a file other than the one behind the image', async () => {
      const result = await service.validateMedia(
        create(NestStorage.StorageObjectType.IMAGE, { image: 'image-1', file: 'file-2' }),
      );

      expect(result.isLeft() && result.value).toBeInstanceOf(BadRequestException);
    });

    it.each([
      ['placed already', { isPlaced: true }],
      ['behind an image or a video', { isBacking: true }],
    ])('refuses a file %s as a bad request, not a name conflict', async (_case, overrides) => {
      repository.getMediaToPlace.mockResolvedValue(media(overrides));

      const result = await service.validateMedia(
        create(NestStorage.StorageObjectType.FILE, { file: 'file-1' }),
      );

      expect(result.isLeft() && result.value).toBeInstanceOf(BadRequestException);
    });

    // Only READY media can be served; an image's and a video's status is its backing file's.
    it.each([
      NestStorage.FileUploadStatus.PENDING,
      NestStorage.FileUploadStatus.FAILED,
      NestStorage.FileUploadStatus.UPLOADED,
    ])('refuses media still %s', async (uploadStatus) => {
      repository.getMediaToPlace.mockResolvedValue(media({ uploadStatus }));

      const result = await service.validateMedia(
        create(NestStorage.StorageObjectType.VIDEO, { video: 'video-1' }),
      );

      expect(result.isLeft() && result.value).toBeInstanceOf(BadRequestException);
      expect(result.isLeft() && result.value.message).toBe('This video is not uploaded yet');
    });
  });

  describe('validateCreateData', () => {
    // A field the rules did not look at never reaches the row.
    it('saves only the media the rules checked', async () => {
      const result = await service.validateCreateData({
        name: 'docs',
        isPublic: false,
        parent: 'root',
        userId: 'owner',
        type: NestStorage.StorageObjectType.FOLDER,
      });

      expect(result.isRight() && result.value).toEqual({
        name: 'docs',
        isPublic: true,
        parent: 'root',
        userId: 'owner',
        type: NestStorage.StorageObjectType.FOLDER,
        isFolder: true,
      });
    });

    it('checks no media and no name when the parent is refused', async () => {
      repository.getOne.mockResolvedValue(left(new NotFoundException()));

      const result = await service.validateCreateData({
        name: 'object.bin',
        isPublic: false,
        parent: 'foreign',
        userId: 'owner',
        type: NestStorage.StorageObjectType.FILE,
        file: 'file-1',
      });

      expect(result.isLeft() && result.value).toBeInstanceOf(NotFoundException);
      expect(repository.getMediaToPlace).not.toHaveBeenCalled();
      expect(repository.distinct).not.toHaveBeenCalled();
    });
  });
});
