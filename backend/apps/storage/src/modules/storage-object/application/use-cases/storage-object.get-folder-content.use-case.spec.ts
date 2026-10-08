import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { NestCommon, NestStorage } from '@backend/proto';
import { StorageObjectRepository } from '@modules/storage-object/domain/repositories/storage-object.repository';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { StorageVideoService } from '@modules/storage/domain/services/storage.video.service';
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

const { FOLDER, FILE, IMAGE, VIDEO } = NestStorage.StorageObjectType;
const { READY } = NestStorage.FileUploadStatus;

// A video's backing file has no key of its own: its bytes live in Stream, under the video's.
const image = (uploadStatus = READY, previewProviderId = 'dev/user-1/photo.preview.webp') =>
  ({
    id: 'image-leaf',
    type: IMAGE,
    isFolder: false,
    file: { id: 'image-file', uploadStatus, providerId: 'dev/user-1/photo.png' },
    image: { id: 'image', previewProviderId },
  }) as NestStorage.StorageObjectPopulated;
const video = (uploadStatus = READY) =>
  ({
    id: 'video-leaf',
    type: VIDEO,
    isFolder: false,
    file: { id: 'video-file', uploadStatus },
    video: { id: 'video', providerId: 'guid' },
  }) as NestStorage.StorageObjectPopulated;

// A plain file's preview is on the file row itself: a PDF's first page (ADR-0032).
const document = (uploadStatus = READY, previewProviderId?: string) =>
  ({
    id: 'doc',
    type: FILE,
    isFolder: false,
    file: { id: 'doc-file', uploadStatus, providerId: 'dev/user-1/doc.pdf', previewProviderId },
  }) as NestStorage.StorageObjectPopulated;

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
  let repository: Record<'getOne' | 'getAncestors' | 'getList' | 'count', Mock>;
  let fileService: { getFileSignedUrl: Mock };
  let videoService: { getThumbnailUrl: Mock };
  let useCase: StorageObjectGetFolderContentUseCase;

  beforeEach(() => {
    repository = {
      getOne: vi.fn().mockResolvedValue(right(folder)),
      getAncestors: vi.fn().mockResolvedValue(right(ancestors)),
      getList: vi.fn().mockResolvedValue({ items, total: 7 }),
      count: vi.fn().mockResolvedValue(3),
    };
    fileService = {
      getFileSignedUrl: vi.fn((providerId: string) => right(`https://storage.test/${providerId}`)),
    };
    videoService = {
      getThumbnailUrl: vi.fn((guid: string) => right(`https://stream.test/${guid}/thumbnail.jpg`)),
    };

    useCase = new StorageObjectGetFolderContentUseCase(
      repository as unknown as StorageObjectRepository,
      fileService as unknown as StorageFileService,
      videoService as unknown as StorageVideoService,
    );
  });

  const listRequest = () => repository.getList.mock.calls[0][0];

  it('answers with the folder, the folders above it and a page of its content', async () => {
    const result = await useCase.execute(request());

    expect(result.isRight() && result.value).toEqual({
      folder,
      ancestors,
      items,
      total: 7,
      folderTotal: 0,
    });
    expect(repository.getAncestors).toHaveBeenCalledWith('folder');
  });

  it('reads the folder as a live folder of the owner, with its path and stats', async () => {
    await useCase.execute(request());

    expect(repository.getOne).toHaveBeenCalledWith(
      {
        id: 'folder',
        userId: 'user-1',
        type: NestStorage.StorageObjectType.FOLDER,
        isDeleted: false,
      },
      { populate: ['folderPath', 'folderStats'] },
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

  it("lists the folder's live objects in its owner's tree, with their media and stats", async () => {
    await useCase.execute(request());

    expect(repository.getList).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ parent: 'folder', userId: 'user-1', isDeleted: false }),
      }),
      { populate: ['file', 'image', 'video', 'folderStats'] },
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
  describe('previews', () => {
    const listed = async (...page: NestStorage.StorageObjectPopulated[]) => {
      repository.getList.mockResolvedValue({ items: page, total: page.length });
      const result = await useCase.execute(request());
      return result.isRight() ? result.value.items : [];
    };

    it('signs a READY image by its preview key', async () => {
      const [item] = await listed(image());

      expect(item.previewUrl).toBe('https://storage.test/dev/user-1/photo.preview.webp');
      expect(fileService.getFileSignedUrl).toHaveBeenCalledWith('dev/user-1/photo.preview.webp');
    });

    // The original may be a 100 MB GIF: a grid shows nothing rather than that.
    it('never signs the original of an image that has no preview yet', async () => {
      const [item] = await listed(image(READY, null));

      expect('previewUrl' in item).toBe(false);
      expect(fileService.getFileSignedUrl).not.toHaveBeenCalled();
    });

    it('gives a READY video its Stream thumbnail', async () => {
      const [item] = await listed(video());

      expect(item.previewUrl).toBe('https://stream.test/guid/thumbnail.jpg');
      expect(videoService.getThumbnailUrl).toHaveBeenCalledWith('guid');
    });

    it.each(['PENDING', 'UPLOADED', 'FAILED'] as const)(
      'signs nothing while the upload is %s',
      async (status) => {
        const uploadStatus = NestStorage.FileUploadStatus[status];
        const page = await listed(image(uploadStatus), video(uploadStatus));

        expect(page.map((item) => 'previewUrl' in item)).toEqual([false, false]);
        expect(fileService.getFileSignedUrl).not.toHaveBeenCalled();
        expect(videoService.getThumbnailUrl).not.toHaveBeenCalled();
      },
    );

    it('signs nothing for a folder or a plain file without a preview', async () => {
      const page = await listed(
        { id: 'sub', type: FOLDER, isFolder: true } as NestStorage.StorageObjectPopulated,
        document(),
      );

      expect(page.map((item) => 'previewUrl' in item)).toEqual([false, false]);
      expect(fileService.getFileSignedUrl).not.toHaveBeenCalled();
      expect(videoService.getThumbnailUrl).not.toHaveBeenCalled();
    });

    it("signs a READY plain file by its own preview key — a PDF's first page", async () => {
      const [item] = await listed(document(READY, 'dev/user-1/doc.preview.webp'));

      expect(item.previewUrl).toBe('https://storage.test/dev/user-1/doc.preview.webp');
      expect(fileService.getFileSignedUrl).toHaveBeenCalledWith('dev/user-1/doc.preview.webp');
    });

    it('leaves the preview out when signing fails, and still answers', async () => {
      fileService.getFileSignedUrl.mockReturnValue(left(new Error('no key')));

      const [item] = await listed(image());

      expect(item).toEqual(image());
      expect('previewUrl' in item).toBe(false);
    });
  });

  // Folders come first, so a page mostly tells how many there are; a count runs only when it cannot.
  describe('folderTotal', () => {
    const subfolder = { id: 'sub', isFolder: true } as NestStorage.StorageObjectPopulated;
    const file = { id: 'file', isFolder: false } as NestStorage.StorageObjectPopulated;

    const folderTotal = async (
      page: NestStorage.StorageObjectPopulated[],
      total: number,
      pagination?: NestCommon.Pagination,
    ) => {
      repository.getList.mockResolvedValue({ items: page, total });
      const result = await useCase.execute(request({ pagination }));
      return result.isRight() ? result.value.folderTotal : undefined;
    };

    it.each([
      ['the first page, folders then files', [subfolder, subfolder, file], 9, undefined, 2],
      ['a later page where the folders end', [subfolder, file, file], 9, { page: 2, limit: 3 }, 4],
      ['the first page, files only', [file, file], 2, { page: 1, limit: 3 }, 0],
      ['the last page, folders only', [subfolder, subfolder], 5, { page: 2, limit: 3 }, 5],
      ['an empty folder', [], 0, undefined, 0],
    ])('reads it off %s, with no count', async (_, page, total, pagination, expected) => {
      expect(await folderTotal(page, total, pagination)).toBe(expected);
      expect(repository.count).not.toHaveBeenCalled();
    });

    it.each([
      ['a later page of files only', [file, file, file], 9, { page: 3, limit: 3 }],
      ['the last page, files only', [file], 7, { page: 3, limit: 3 }],
      ['a full page of folders', [subfolder, subfolder, subfolder], 9, { page: 1, limit: 3 }],
      ['a page past the end', [], 4, { page: 3, limit: 3 }],
      ['a later page with no limit', [subfolder, file], 9, { page: 2 }],
    ])('counts the folders under the same scope for %s', async (_, page, total, pagination) => {
      expect(await folderTotal(page, total, pagination)).toBe(3);
      expect(repository.count).toHaveBeenCalledWith(
        expect.objectContaining({
          parent: 'folder',
          userId: 'user-1',
          isDeleted: false,
          isFolder: true,
        }),
      );
    });
  });
});
