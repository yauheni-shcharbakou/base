import { NestCommon, NestStorage } from '@backend/proto';
import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import { NotFoundException } from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import { StorageObjectGetFolderContentUseCase } from './storage-object.get-folder-content.use-case';

const folder = {
  id: 'folder',
  userId: 'user-1',
  isFolder: true,
  folderPath: '/a/',
} as NestStorage.StorageObjectPopulated;
const ancestors: NestStorage.StorageObjectAncestor[] = [{ id: 'root', name: '' }];
const items = [{ id: 'child' }] as NestStorage.StorageObjectPopulated[];

const FOLDERS_FIRST = { field: 'isFolder', order: NestCommon.Sort.desc };
const BY_ID = { field: 'id', order: NestCommon.Sort.asc };

const request = (
  overrides: Partial<NestStorage.StorageObjectGetFolderContent> = {},
): NestStorage.StorageObjectGetFolderContent => ({
  parentId: 'folder',
  userId: 'user-1',
  sorters: [],
  ...overrides,
});

describe('StorageObjectGetFolderContentUseCase', () => {
  let repository: { getOne: jest.Mock; getAncestors: jest.Mock; getList: jest.Mock };
  let useCase: StorageObjectGetFolderContentUseCase;

  beforeEach(() => {
    repository = {
      getOne: jest.fn().mockResolvedValue(right(folder)),
      getAncestors: jest.fn().mockResolvedValue(right(ancestors)),
      getList: jest.fn().mockResolvedValue({ items, total: 7 }),
    };

    useCase = new StorageObjectGetFolderContentUseCase(
      repository as unknown as StorageObjectRepository,
    );
  });

  const listRequest = () => repository.getList.mock.calls[0][0];

  it('answers with the folder, the folders above it and a page of its content', async () => {
    const result = await useCase.execute(request());

    expect(result.isRight() && result.value).toEqual({ folder, ancestors, items, total: 7 });
    expect(repository.getAncestors).toHaveBeenCalledWith('folder');
  });

  it('reads the folder as a live folder of the owner, with its path', async () => {
    await useCase.execute(request());

    expect(repository.getOne).toHaveBeenCalledWith(
      {
        id: 'folder',
        userId: 'user-1',
        type: NestStorage.StorageObjectType.FOLDER,
        isDeleted: false,
      },
      { populate: ['folderPath'] },
    );
  });

  // Missing, deleted, another user's or a leaf: the scoped read misses all of them alike.
  it('lists nothing when the folder is not found', async () => {
    const notFound = new NotFoundException('Storage object not found');
    repository.getOne.mockResolvedValue(left(notFound));

    const result = await useCase.execute(request());

    expect(result.isLeft() && result.value).toBe(notFound);
    expect(repository.getAncestors).not.toHaveBeenCalled();
    expect(repository.getList).not.toHaveBeenCalled();
  });

  it('fails instead of answering without the folders above when the walk fails', async () => {
    const failure = new Error('connection lost');
    repository.getAncestors.mockResolvedValue(left(failure));

    const result = await useCase.execute(request());

    expect(result.isLeft() && result.value).toBe(failure);
    expect(repository.getList).not.toHaveBeenCalled();
  });

  it("lists the folder's live objects in its owner's tree, with their media", async () => {
    await useCase.execute(request());

    expect(repository.getList).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ parent: 'folder', userId: 'user-1', isDeleted: false }),
      }),
      { populate: ['file', 'image', 'video'] },
    );
  });

  it('sorts folders first, then by name, then by id', async () => {
    await useCase.execute(request());

    expect(listRequest().sorters).toEqual([
      FOLDERS_FIRST,
      { field: 'name', order: NestCommon.Sort.asc },
      BY_ID,
    ]);
  });

  it("puts the caller's sorters in place of the name, between the folders and the id", async () => {
    const { NAME, CREATED_AT, UPDATED_AT, TYPE } = NestStorage.StorageObjectSortField;

    await useCase.execute(
      request({
        sorters: [
          { field: TYPE, order: NestCommon.Sort.asc },
          { field: UPDATED_AT, order: NestCommon.Sort.desc },
          { field: CREATED_AT, order: NestCommon.Sort.asc },
          { field: NAME, order: NestCommon.Sort.desc },
        ],
      }),
    );

    expect(listRequest().sorters).toEqual([
      FOLDERS_FIRST,
      { field: 'type', order: NestCommon.Sort.asc },
      { field: 'updatedAt', order: NestCommon.Sort.desc },
      { field: 'createdAt', order: NestCommon.Sort.asc },
      { field: 'name', order: NestCommon.Sort.desc },
      BY_ID,
    ]);
  });

  it('narrows the list by the content query and pages it', async () => {
    const pagination = { page: 2, limit: 20 };

    await useCase.execute(
      request({
        query: { types: [NestStorage.StorageObjectType.IMAGE], isPublic: true, search: 'cat' },
        pagination,
      }),
    );

    expect(listRequest()).toMatchObject({
      query: { types: [NestStorage.StorageObjectType.IMAGE], isPublic: true, nameContains: 'cat' },
      pagination,
    });
  });
});
