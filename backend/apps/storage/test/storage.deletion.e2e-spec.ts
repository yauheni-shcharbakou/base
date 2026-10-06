import { FileEventBus, FilePurgeEvent, FilePurgeType } from '@backend/event-bus';
import { NestCommon, NestStorage } from '@backend/proto';
import { Config } from '@/config';
import { PgStorageObjectEntity } from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { PgFileEntity } from '@common/infrastructure/pg/entities/pg.file.entity';
import { PgImageEntity } from '@common/infrastructure/pg/entities/pg.image.entity';
import { PgVideoEntity } from '@common/infrastructure/pg/entities/pg.video.entity';
import { FileDropService } from '@modules/file/application/services/file.drop.service';
import { FilePurgeService } from '@modules/file/application/services/file.purge.service';
import {
  FileCleanupUseCase,
  UPLOAD_GRACE_MINUTES,
} from '@modules/file/application/use-cases/file.cleanup.use-case';
import { FileDeleteByOwnerUseCase } from '@modules/file/application/use-cases/file.delete-by-owner.use-case';
import { StorageObjectPlacementService } from '@modules/storage-object/application/services/storage-object.placement.service';
import { StorageObjectValidationService } from '@modules/storage-object/application/services/storage-object.validation.service';
import { PgFileRepositoryImpl } from '@modules/file/infrastructure/pg/repositories/pg.file.repository.impl';
import { PgImageRepositoryImpl } from '@modules/image/infrastructure/pg/repositories/pg.image.repository.impl';
import { StorageObjectCleanupUseCase } from '@modules/storage-object/application/use-cases/storage-object.cleanup.use-case';
import { StorageObjectCreateOneUseCase } from '@modules/storage-object/application/use-cases/storage-object.create-one.use-case';
import { StorageObjectDeleteOneUseCase } from '@modules/storage-object/application/use-cases/storage-object.delete-one.use-case';
import { StorageObjectDeleteRootFolderUseCase } from '@modules/storage-object/application/use-cases/storage-object.delete-root-folder.use-case';
import { PgStorageObjectRepositoryImpl } from '@modules/storage-object/infrastructure/pg/repositories/pg.storage-object.repository.impl';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { StorageVideoService } from '@modules/storage/domain/services/storage.video.service';
import { PgVideoRepositoryImpl } from '@modules/video/infrastructure/pg/repositories/pg.video.repository.impl';
import { EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { left } from '@sweet-monads/either';
import assert from 'node:assert/strict';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { startOrm } from './pg.e2e';

const USER_ID = '01JQ0000000000000000000000';
const OTHER_USER_ID = '01JQ0000000000000000000009';

type Table = 'files' | 'images' | 'videos' | 'storage-objects';

/**
 * The deletion paths end in Postgres — FK cascades, a recursive `UPDATE`, a bottom-up `DELETE` —
 * so they are exercised against a real, migrated database rather than a mocked repository.
 */
describe('storage deletion against Postgres', () => {
  let orm: MikroORM | undefined;
  let em: EntityManager;
  let fileRepository: PgFileRepositoryImpl;
  let imageRepository: PgImageRepositoryImpl;
  let videoRepository: PgVideoRepositoryImpl;
  let storageObjectRepository: PgStorageObjectRepositoryImpl;

  // In a hook, not in the suite body, which Vitest collects synchronously and cannot await.
  beforeAll(async () => {
    orm = await startOrm();

    if (!orm) {
      return;
    }

    em = orm.em;
    fileRepository = new PgFileRepositoryImpl(em.getRepository(PgFileEntity));
    imageRepository = new PgImageRepositoryImpl(em.getRepository(PgImageEntity));
    videoRepository = new PgVideoRepositoryImpl(em.getRepository(PgVideoEntity));
    storageObjectRepository = new PgStorageObjectRepositoryImpl(
      em.getRepository(PgStorageObjectEntity),
    );
  });

  afterAll(() => orm?.close());

  // Skipped rather than failed without a server, like the Redis e2e suites.
  const withDb = (name: string, fn: () => Promise<void>) =>
    it(name, (t) => (orm ? fn() : t.skip('no Postgres — start one with `pnpm docker:db`')));

  let purged: FilePurgeEvent[];
  const filePurgeService = new FilePurgeService({
    emitManyPurge: (events: FilePurgeEvent[]) => Promise.resolve(purged.push(...events)),
  } as unknown as FileEventBus);

  let root: string;

  beforeEach(async () => {
    if (!orm) {
      return;
    }

    await orm.schema.clear();
    purged = [];
    root = await createFolder('root');
  });

  // Every read goes to the database: the statements under test bypass the identity map.
  const count = async (table: Table, where = 'true', params: unknown[] = []): Promise<number> => {
    em.clear();
    const [row] = await em
      .getConnection()
      .execute<{ n: number }[]>(`select count(*)::int as n from "${table}" where ${where}`, params);
    return row.n;
  };

  const exists = async (table: Table, id: string) => (await count(table, 'id = ?', [id])) === 1;

  const createFolder = async (name: string, parent?: string): Promise<string> => {
    const folder = em.create(PgStorageObjectEntity, {
      userId: USER_ID,
      name,
      type: NestStorage.StorageObjectType.FOLDER,
      isFolder: true,
      isPublic: false,
      ...(parent ? { parent } : {}),
    } as never);

    await em.persist(folder).flush();
    return folder.id;
  };

  const fileMeta = (providerId?: string, uploadStatus = NestStorage.FileUploadStatus.READY) => ({
    originalName: 'object.bin',
    mimeType: 'application/octet-stream',
    size: 1,
    extension: 'bin',
    uploadStatus,
    providerId,
  });

  // A name of its own for every leaf: names are unique per folder, and the database enforces it.
  let leafCount = 0;
  const placement = (parent: string) => ({
    name: `object-${++leafCount}.bin`,
    isPublic: false,
    parent,
  });

  const placeFile = async (
    parent: string,
    providerId: string,
    status = NestStorage.FileUploadStatus.READY,
  ) => {
    const file = await fileRepository.saveAndPlaceOne({
      file: { ...fileMeta(providerId, status), userId: USER_ID },
      storageObject: placement(parent),
    });

    return file.unwrap();
  };

  const placeImage = async (
    parent: string,
    providerId: string,
    status = NestStorage.FileUploadStatus.READY,
  ) => {
    const image = await imageRepository.saveAndPlaceOne({
      image: { width: 1, height: 1, alt: '', userId: USER_ID },
      file: fileMeta(providerId, status),
      storageObject: placement(parent),
    });

    return image.unwrap();
  };

  // A video's Stream guid sits on the video row; its backing file row never carries a providerId.
  const placeVideo = async (
    parent: string,
    providerId: string,
    status = NestStorage.FileUploadStatus.READY,
  ) => {
    const video = await videoRepository.saveAndPlaceOne({
      video: { title: 'video', providerId, userId: USER_ID },
      file: fileMeta(undefined, status),
      storageObject: placement(parent),
    });

    return video.unwrap();
  };

  const TTL_HOURS = 24;

  // The longer upload window, a video's: a PENDING row is called failed an hour of grace past it.
  const UPLOAD_WINDOW_HOURS = 2;
  const FAIL_AFTER_HOURS = UPLOAD_WINDOW_HOURS + UPLOAD_GRACE_MINUTES / 60;

  const fileCleanup = () =>
    new FileCleanupUseCase(
      fileRepository,
      new FileDropService(fileRepository, filePurgeService),
      { uploadWindowMinutes: 60 } as StorageFileService,
      { uploadWindowMinutes: UPLOAD_WINDOW_HOURS * 60 } as StorageVideoService,
      { getOrThrow: () => TTL_HOURS } as unknown as ConfigService<Config>,
    );

  const statusOf = async (fileId: string): Promise<string> => {
    em.clear();
    const [row] = await em
      .getConnection()
      .execute<{ upload_status: string }[]>(`select upload_status from "files" where id = ?`, [
        fileId,
      ]);
    return row.upload_status;
  };

  // `created_at` is set by the entity on insert; the stale sweep keys on it.
  const ageFile = async (fileId: string, hours: number) => {
    await em
      .getConnection()
      .execute(`update "files" set created_at = now() - make_interval(hours => ?) where id = ?`, [
        hours,
        fileId,
      ]);
  };

  const purgeKeys = (events: FilePurgeEvent[]) =>
    events.map(({ type, providerId }) => `${type}:${providerId}`).sort();

  // A media create places its row under the owner's tree lock; the repository's own transaction has
  // to join the lock's, or the lock would be released before the row it guards is written.
  describe('placeLeaves', () => {
    const placementService = () =>
      new StorageObjectPlacementService(
        storageObjectRepository,
        new StorageObjectValidationService(storageObjectRepository),
      );

    withDb('saves a placed file in the lock’s transaction, and rolls back with it', async () => {
      const result = await placementService().placeLeaves(
        {
          userId: USER_ID,
          parent: root,
          type: NestStorage.StorageObjectType.FILE,
          names: ['object.bin'],
        },
        async (leaves) => {
          const saved = await fileRepository.saveAndPlaceOne({
            file: { ...fileMeta('dev/file'), userId: USER_ID },
            storageObject: leaves?.[0],
          });
          assert.ok(saved.isRight());

          return left(new Error('refused after the save'));
        },
      );

      assert.equal(result.isLeft() && result.value.message, 'refused after the save');
      assert.equal(await count('files'), 0);
      assert.equal(await count('storage-objects', 'is_folder = false'), 0);
    });

    withDb('places a leaf with the folder’s visibility and a free name', async () => {
      await placeFile(root, 'dev/first');
      await em
        .getConnection()
        .execute('update "storage-objects" set is_public = true where id = ?', [root]);

      const file = await placementService().placeLeaves(
        {
          userId: USER_ID,
          parent: root,
          type: NestStorage.StorageObjectType.FILE,
          names: [`object-${leafCount}.bin`],
        },
        (leaves) =>
          fileRepository.saveAndPlaceOne({
            file: { ...fileMeta('dev/second'), userId: USER_ID },
            storageObject: leaves?.[0],
          }),
      );

      assert.ok(file.isRight());
      assert.equal(
        await count('storage-objects', 'file_id = ? and is_public and name = ?', [
          file.value.id,
          `object-${leafCount} (1).bin`,
        ]),
        1,
      );
    });
  });

  // A `*CreatedArray` answers its request by position, and the create-many use cases zip the saved
  // rows back with their items, so a repository that reordered them would mismatch every upload.
  describe('saveAndPlaceMany keeps item order', () => {
    const names = ['c', 'a', 'd', 'b'];

    withDb('files', async () => {
      const files = await fileRepository.saveAndPlaceMany(
        names.map((name) => ({
          file: { ...fileMeta(`dev/${name}`), originalName: name, userId: USER_ID },
          storageObject: placement(root),
        })),
      );

      assert.deepEqual(
        files.unwrap().map(({ originalName }) => originalName),
        names,
      );
    });

    withDb('images', async () => {
      const images = await imageRepository.saveAndPlaceMany(
        names.map((name) => ({
          image: { width: 1, height: 1, alt: name, userId: USER_ID },
          file: fileMeta(`dev/${name}`),
          storageObject: placement(root),
        })),
      );

      assert.deepEqual(
        images.unwrap().map(({ alt }) => alt),
        names,
      );
    });

    withDb('videos', async () => {
      const videos = await videoRepository.saveAndPlaceMany(
        names.map((name) => ({
          video: { title: name, providerId: name, userId: USER_ID },
          file: fileMeta(),
          storageObject: placement(root),
        })),
      );

      assert.deepEqual(
        videos.unwrap().map(({ title }) => title),
        names,
      );
    });
  });

  // A leaf created over media that already exists. Deleting a leaf deletes the media under it, so a
  // leaf over another user's media would let its owner delete that media.
  describe('placing existing media', () => {
    const createOne = () =>
      new StorageObjectCreateOneUseCase(
        storageObjectRepository,
        new StorageObjectValidationService(storageObjectRepository),
      );

    const leafRequest = (
      type: NestStorage.StorageObjectType,
      media: Partial<Record<'file' | 'image' | 'video', string>>,
    ): NestStorage.StorageObjectCreate => ({
      name: `object-${++leafCount}.bin`,
      isPublic: false,
      parent: root,
      userId: USER_ID,
      type,
      ...media,
    });

    const unplacedFile = async (userId: string, providerId: string) =>
      (
        await fileRepository.saveAndPlaceOne({
          file: { ...fileMeta(providerId), userId },
        })
      ).unwrap();

    withDb('refuses another user’s file, which the cleanup then leaves alone', async () => {
      const foreign = await unplacedFile(OTHER_USER_ID, 'dev/foreign');

      const created = await createOne().execute(
        leafRequest(NestStorage.StorageObjectType.FILE, { file: foreign.id }),
      );

      assert.ok(created.isLeft() && created.value.message === 'File not found');
      assert.equal(await count('storage-objects', 'file_id = ?', [foreign.id]), 0);

      await storageObjectRepository.markDeletedWithDescendants(root);
      await fileCleanup().execute();

      assert.equal(await exists('files', foreign.id), true);
      assert.deepEqual(purged, []);
    });

    withDb('places the owner’s file, and deleting the leaf deletes the file', async () => {
      const own = await unplacedFile(USER_ID, 'dev/own');

      const leaf = (
        await createOne().execute(leafRequest(NestStorage.StorageObjectType.FILE, { file: own.id }))
      ).unwrap();

      await storageObjectRepository.markDeletedWithDescendants(leaf.id);
      await fileCleanup().execute();

      assert.equal(await exists('files', own.id), false);
      assert.deepEqual(purgeKeys(purged), [`${FilePurgeType.FILE}:dev/own`]);
    });

    withDb('places an image together with the file behind it', async () => {
      const image = (
        await imageRepository.saveAndPlaceOne({
          image: { width: 1, height: 1, alt: '', userId: USER_ID },
          file: fileMeta('dev/image'),
        })
      ).unwrap();

      const leaf = await createOne().execute(
        leafRequest(NestStorage.StorageObjectType.IMAGE, { image: image.id }),
      );

      assert.ok(leaf.isRight());
      assert.equal(
        await count('storage-objects', 'image_id = ? and file_id = ?', [image.id, image.fileId]),
        1,
      );
    });

    withDb('refuses media placed already, and a file behind an image', async () => {
      const placed = await placeFile(root, 'dev/placed');
      const image = await placeImage(root, 'dev/image');

      const again = await createOne().execute(
        leafRequest(NestStorage.StorageObjectType.FILE, { file: placed.id }),
      );
      const backing = await createOne().execute(
        leafRequest(NestStorage.StorageObjectType.FILE, { file: image.fileId }),
      );

      assert.ok(again.isLeft() && again.value instanceof BadRequestException);
      assert.ok(backing.isLeft() && backing.value instanceof BadRequestException);
    });

    // An image's status is its backing file's.
    withDb('refuses a file or an image whose upload is not READY', async () => {
      const pending = (
        await fileRepository.saveAndPlaceOne({
          file: {
            ...fileMeta('dev/pending', NestStorage.FileUploadStatus.PENDING),
            userId: USER_ID,
          },
        })
      ).unwrap();
      const image = (
        await imageRepository.saveAndPlaceOne({
          image: { width: 1, height: 1, alt: '', userId: USER_ID },
          file: fileMeta('dev/image', NestStorage.FileUploadStatus.FAILED),
        })
      ).unwrap();

      const file = await createOne().execute(
        leafRequest(NestStorage.StorageObjectType.FILE, { file: pending.id }),
      );
      const placedImage = await createOne().execute(
        leafRequest(NestStorage.StorageObjectType.IMAGE, { image: image.id }),
      );

      assert.ok(file.isLeft() && file.value.message === 'This file is not uploaded yet');
      assert.ok(
        placedImage.isLeft() && placedImage.value.message === 'This image is not uploaded yet',
      );
    });
  });

  // What a media picker asks for: the owner's media that nothing places yet and that is READY.
  // `getList` answers a failed query with an empty page, so every case expects rows back.
  describe('media lists', () => {
    const filter = (field: string, value: string | boolean): NestCommon.LogicalFilter => ({
      field,
      operator: NestCommon.LogicalOperator.eq,
      ...(typeof value === 'boolean' ? { boolean: value } : { string: value }),
    });

    const placeable = (isPlaced = false) => [
      filter('userId', USER_ID),
      filter('isPlaced', isPlaced),
      filter('uploadStatus', NestStorage.FileUploadStatus.READY),
    ];

    const ids = (page: { items: { id: string }[] }) => page.items.map(({ id }) => id).sort();

    const unplaced = async (
      userId: string,
      providerId: string,
      status = NestStorage.FileUploadStatus.READY,
    ) =>
      (
        await fileRepository.saveAndPlaceOne({
          file: { ...fileMeta(providerId, status), userId },
        })
      ).unwrap();

    withDb('lists the owner’s unplaced READY files only', async () => {
      const free = await unplaced(USER_ID, 'dev/free');
      const placed = await placeFile(root, 'dev/placed');
      await unplaced(OTHER_USER_ID, 'dev/foreign');
      await unplaced(USER_ID, 'dev/pending', NestStorage.FileUploadStatus.PENDING);

      em.clear();
      const unplacedPage = await fileRepository.getList({ logicalFilters: placeable() });
      const placedPage = await fileRepository.getList({ logicalFilters: placeable(true) });

      assert.deepEqual(ids(unplacedPage), [free.id]);
      assert.deepEqual(ids(placedPage), [placed.id]);
    });

    // A file behind an image or a video is placed through that media, never as a file.
    withDb('leaves out a file that backs an image or a video', async () => {
      const free = await unplaced(USER_ID, 'dev/free');
      const image = (
        await imageRepository.saveAndPlaceOne({
          image: { width: 1, height: 1, alt: '', userId: USER_ID },
          file: fileMeta('dev/image'),
        })
      ).unwrap();

      em.clear();
      const plain = await fileRepository.getList({
        logicalFilters: [...placeable(), filter('isBacking', false)],
      });
      const backing = await fileRepository.getList({
        logicalFilters: [...placeable(), filter('isBacking', true)],
      });

      assert.deepEqual(ids(plain), [free.id]);
      assert.deepEqual(ids(backing), [image.fileId]);
    });

    withDb('filters images and videos on their backing file’s status', async () => {
      const image = (
        await imageRepository.saveAndPlaceOne({
          image: { width: 1, height: 1, alt: '', userId: USER_ID },
          file: fileMeta('dev/image'),
        })
      ).unwrap();
      await imageRepository.saveAndPlaceOne({
        image: { width: 1, height: 1, alt: '', userId: USER_ID },
        file: fileMeta('dev/pending-image', NestStorage.FileUploadStatus.PENDING),
      });
      await placeImage(root, 'dev/placed-image');

      const video = (
        await videoRepository.saveAndPlaceOne({
          video: { title: 'video', providerId: 'guid', userId: USER_ID },
          file: fileMeta(undefined),
        })
      ).unwrap();
      await videoRepository.saveAndPlaceOne({
        video: { title: 'video', providerId: 'encoding', userId: USER_ID },
        file: fileMeta(undefined, NestStorage.FileUploadStatus.UPLOADED),
      });

      em.clear();
      const images = await imageRepository.getList({ logicalFilters: placeable() });
      const videos = await videoRepository.getList({ logicalFilters: placeable() });

      assert.deepEqual(ids(images), [image.id]);
      assert.deepEqual(ids(videos), [video.id]);
    });
  });

  describe('deleteWithFile', () => {
    withDb('takes an image’s file row and storage object with it', async () => {
      const image = await placeImage(root, 'dev/image');

      assert.ok((await imageRepository.deleteWithFile(image.id)).isRight());

      assert.equal(await exists('images', image.id), false);
      assert.equal(await exists('files', image.fileId), false);
      assert.equal(await count('storage-objects', 'image_id is not null'), 0);
    });

    withDb('takes a video’s file row and storage object with it', async () => {
      const video = await placeVideo(root, 'video-guid');

      assert.ok((await videoRepository.deleteWithFile(video.id)).isRight());

      assert.equal(await exists('videos', video.id), false);
      assert.equal(await exists('files', video.fileId), false);
      assert.equal(await count('storage-objects', 'video_id is not null'), 0);
    });

    withDb('leaves the other media alone', async () => {
      const image = await placeImage(root, 'dev/image');
      const other = await placeImage(root, 'dev/other');

      await imageRepository.deleteWithFile(image.id);

      assert.equal(await exists('images', other.id), true);
      assert.equal(await exists('files', other.fileId), true);
    });
  });

  // What the file cleanup cron relies on: it deletes file rows only.
  withDb('cascades a file row delete to its image, video and storage object', async () => {
    const image = await placeImage(root, 'dev/image');
    const video = await placeVideo(root, 'video-guid');
    const file = await placeFile(root, 'dev/file');

    em.clear();
    const ids = [image.fileId, video.fileId, file.id];
    assert.equal(await fileRepository.deleteMany({ ids }), true);

    assert.equal(await count('files'), 0);
    assert.equal(await count('images'), 0);
    assert.equal(await count('videos'), 0);
    assert.equal(await count('storage-objects', 'is_folder = false'), 0);
  });

  describe('markDeletedWithDescendants', () => {
    withDb('marks the object and its whole subtree, and nothing else', async () => {
      const folder = await createFolder('a', root);
      const nested = await createFolder('b', folder);
      await placeFile(nested, 'dev/nested');
      const sibling = await createFolder('sibling', root);
      await placeFile(sibling, 'dev/sibling');

      const marked = await storageObjectRepository.markDeletedWithDescendants(folder);

      // a, b and the file under b.
      assert.equal(marked.unwrap(), 3);
      assert.equal(await count('storage-objects', 'is_deleted'), 3);
      assert.equal(
        await count('storage-objects', 'is_deleted and id in (?, ?)', [root, sibling]),
        0,
      );
    });

    withDb('skips what is already marked', async () => {
      const folder = await createFolder('a', root);

      await storageObjectRepository.markDeletedWithDescendants(folder);
      const again = await storageObjectRepository.markDeletedWithDescendants(folder);

      assert.equal(again.unwrap(), 0);
    });
  });

  describe('getManyInDeletedStorageObjects', () => {
    withDb('returns the files placed in a deleted object, with the video they back', async () => {
      const folder = await createFolder('a', root);
      const video = await placeVideo(folder, 'video-guid');
      const file = await placeFile(folder, 'dev/file');
      await placeFile(root, 'dev/kept');
      await storageObjectRepository.markDeletedWithDescendants(folder);

      em.clear();
      const files = await fileRepository.getManyInDeletedStorageObjects(10);

      assert.deepEqual(files.map(({ id }) => id).sort(), [video.fileId, file.id].sort());
      assert.equal(files.find(({ id }) => id === video.fileId)?.video?.providerId, 'video-guid');
    });

    withDb('honours the limit', async () => {
      const folder = await createFolder('a', root);
      await placeFile(folder, 'dev/one');
      await placeFile(folder, 'dev/two');
      await storageObjectRepository.markDeletedWithDescendants(folder);

      em.clear();
      assert.equal((await fileRepository.getManyInDeletedStorageObjects(1)).length, 1);
    });
  });

  describe('deleteEmptyDeletedFolders', () => {
    withDb('removes one level per pass, bottom first, and never makes a second root', async () => {
      const a = await createFolder('a', root);
      const b = await createFolder('b', a);
      const c = await createFolder('c', b);
      await storageObjectRepository.markDeletedWithDescendants(a);

      for (const expected of [c, b, a]) {
        assert.equal((await storageObjectRepository.deleteEmptyDeletedFolders()).unwrap(), 1);
        assert.equal(await exists('storage-objects', expected), false);
        // Never a parent first: `parent_id` is `on delete no action`, so that would fail the
        // statement — and before, under `set null`, turned the child into a second root.
        assert.equal(await count('storage-objects', 'parent_id is null'), 1);
      }

      assert.equal((await storageObjectRepository.deleteEmptyDeletedFolders()).unwrap(), 0);
      assert.equal(await exists('storage-objects', root), true);
    });

    withDb('keeps a deleted folder while a file is still placed in it', async () => {
      const folder = await createFolder('a', root);
      await placeFile(folder, 'dev/file');
      await storageObjectRepository.markDeletedWithDescendants(folder);

      assert.equal((await storageObjectRepository.deleteEmptyDeletedFolders()).unwrap(), 0);
      assert.equal(await exists('storage-objects', folder), true);
    });

    withDb('leaves live empty folders alone', async () => {
      const folder = await createFolder('a', root);

      assert.equal((await storageObjectRepository.deleteEmptyDeletedFolders()).unwrap(), 0);
      assert.equal(await exists('storage-objects', folder), true);
    });
  });

  // The cron's first step: an upload whose window has closed is called failed, long before the TTL.
  describe('expired upload mark', () => {
    const { PENDING, UPLOADED, READY, FAILED } = NestStorage.FileUploadStatus;

    withDb('turns FAILED a PENDING row past the upload window, and keeps the row', async () => {
      const file = await placeFile(root, 'dev/abandoned', PENDING);
      const video = await placeVideo(root, 'abandoned-guid', PENDING);
      await ageFile(file.id, FAIL_AFTER_HOURS + 1);
      await ageFile(video.fileId, FAIL_AFTER_HOURS + 1);

      em.clear();
      await fileCleanup().execute();

      assert.equal(await statusOf(file.id), FAILED);
      assert.equal(await statusOf(video.fileId), FAILED);
      assert.deepEqual(purged, []);
    });

    withDb('leaves an upload inside the window, and every other status', async () => {
      const uploading = await placeFile(root, 'dev/uploading', PENDING);
      const encoding = await placeVideo(root, 'encoding-guid', UPLOADED);
      const ready = await placeFile(root, 'dev/ready', READY);
      await ageFile(uploading.id, FAIL_AFTER_HOURS - 1);
      await ageFile(encoding.fileId, FAIL_AFTER_HOURS + 1);
      await ageFile(ready.id, FAIL_AFTER_HOURS + 1);

      em.clear();
      await fileCleanup().execute();

      assert.equal(await statusOf(uploading.id), PENDING);
      assert.equal(await statusOf(encoding.fileId), UPLOADED);
      assert.equal(await statusOf(ready.id), READY);
    });
  });

  // The other sweep of the same cron: uploads that never completed within the TTL.
  describe('stale upload sweep', () => {
    withDb('drops PENDING and FAILED rows past the TTL, media and placement included', async () => {
      const image = await placeImage(
        root,
        'dev/pending-image',
        NestStorage.FileUploadStatus.PENDING,
      );
      const video = await placeVideo(root, 'failed-guid', NestStorage.FileUploadStatus.FAILED);
      const file = await placeFile(root, 'dev/pending-file', NestStorage.FileUploadStatus.PENDING);

      for (const fileId of [image.fileId, video.fileId, file.id]) {
        await ageFile(fileId, TTL_HOURS + 1);
      }

      em.clear();
      await fileCleanup().execute();

      assert.equal(await count('files'), 0);
      assert.equal(await count('images'), 0);
      assert.equal(await count('videos'), 0);
      assert.equal(await count('storage-objects', 'is_folder = false'), 0);
      assert.deepEqual(purgeKeys(purged), [
        `${FilePurgeType.FILE}:dev/pending-file`,
        `${FilePurgeType.FILE}:dev/pending-image`,
        `${FilePurgeType.VIDEO}:failed-guid`,
      ]);
    });

    withDb('keeps an unfinished upload still inside the TTL', async () => {
      const file = await placeFile(root, 'dev/pending', NestStorage.FileUploadStatus.PENDING);
      await ageFile(file.id, TTL_HOURS - 1);

      em.clear();
      await fileCleanup().execute();

      assert.equal(await exists('files', file.id), true);
      assert.deepEqual(purged, []);
    });

    // UPLOADED means Bunny is still encoding — a missing webhook is the hourly sync's to rescue,
    // not a reason to delete. READY is done.
    withDb('never touches UPLOADED or READY, however old', async () => {
      const encoding = await placeVideo(
        root,
        'encoding-guid',
        NestStorage.FileUploadStatus.UPLOADED,
      );
      const ready = await placeFile(root, 'dev/ready', NestStorage.FileUploadStatus.READY);
      await ageFile(encoding.fileId, TTL_HOURS * 10);
      await ageFile(ready.id, TTL_HOURS * 10);

      em.clear();
      await fileCleanup().execute();

      assert.equal(await exists('videos', encoding.id), true);
      assert.equal(await exists('files', ready.id), true);
      assert.deepEqual(purged, []);
    });

    withDb('purges nothing for a stale row that never reached the provider', async () => {
      const file = await placeFile(root, '', NestStorage.FileUploadStatus.PENDING);
      await ageFile(file.id, TTL_HOURS + 1);

      em.clear();
      await fileCleanup().execute();

      assert.equal(await exists('files', file.id), false);
      assert.deepEqual(purged, []);
    });
  });

  // The whole path a folder delete takes: the gRPC use-case marks, the two crons sweep.
  withDb(
    'removes a deleted folder with all its media and purges each provider object once',
    async () => {
      const folder = await createFolder('a', root);
      const nested = await createFolder('b', folder);
      const image = await placeImage(folder, 'dev/image');
      (await imageRepository.setPreview(image.id, 'dev/image.preview.webp')).unwrap();
      await placeVideo(folder, 'video-guid');
      const nestedFile = await placeFile(nested, 'dev/nested');
      (await fileRepository.setPreview(nestedFile.id, 'dev/nested.preview.webp')).unwrap();
      const kept = await placeFile(root, 'dev/kept');

      const deleteOne = new StorageObjectDeleteOneUseCase(storageObjectRepository);
      const folderCleanup = new StorageObjectCleanupUseCase(storageObjectRepository);

      assert.ok((await deleteOne.execute({ id: folder })).isRight());
      em.clear();
      await fileCleanup().execute();
      em.clear();
      await folderCleanup.execute();

      assert.equal(await count('files'), 1);
      assert.equal(await exists('files', kept.id), true);
      assert.equal(await count('images'), 0);
      assert.equal(await count('videos'), 0);
      assert.equal(await count('storage-objects'), 2);
      assert.equal(await exists('storage-objects', root), true);

      assert.deepEqual(purgeKeys(purged), [
        `${FilePurgeType.FILE}:dev/image`,
        `${FilePurgeType.FILE}:dev/image.preview.webp`,
        `${FilePurgeType.FILE}:dev/nested`,
        `${FilePurgeType.FILE}:dev/nested.preview.webp`,
        `${FilePurgeType.VIDEO}:video-guid`,
      ]);
    },
  );

  // What `auth.user.delete` sets off: storage-object marks the tree, file drops every media the user
  // owns — placed or not — and the folder cleanup then takes the emptied folders, the root last.
  withDb(
    'removes a deleted user’s tree and every media they own, and leaves other users alone',
    async () => {
      const folder = await createFolder('a', root);
      const image = await placeImage(folder, 'dev/image');
      (await imageRepository.setPreview(image.id, 'dev/image.preview.webp')).unwrap();
      await placeVideo(root, 'video-guid');
      await placeFile(folder, 'dev/placed');
      await fileRepository.saveAndPlaceOne({
        file: { ...fileMeta('dev/unplaced'), userId: USER_ID },
      });
      await imageRepository.saveAndPlaceOne({
        image: { width: 1, height: 1, alt: '', userId: USER_ID },
        file: fileMeta('dev/unplaced-image'),
      });

      const otherRoot = em.create(PgStorageObjectEntity, {
        userId: OTHER_USER_ID,
        name: '',
        type: NestStorage.StorageObjectType.FOLDER,
        isFolder: true,
        isPublic: false,
      } as never);
      await em.persist(otherRoot).flush();
      const foreign = (
        await fileRepository.saveAndPlaceOne({
          file: { ...fileMeta('dev/foreign'), userId: OTHER_USER_ID },
          storageObject: placement(otherRoot.id),
        })
      ).unwrap();

      const deleteRoot = new StorageObjectDeleteRootFolderUseCase(storageObjectRepository);
      const deleteMedia = new FileDeleteByOwnerUseCase(
        fileRepository,
        new FileDropService(fileRepository, filePurgeService),
      );
      const folderCleanup = new StorageObjectCleanupUseCase(storageObjectRepository);

      em.clear();
      assert.ok((await deleteRoot.execute(USER_ID)).isRight());
      em.clear();
      const dropped = await deleteMedia.execute(USER_ID);
      assert.ok(dropped.isRight() && dropped.value === 5);

      // At-least-once: a redelivery of either half finds nothing left to do.
      em.clear();
      assert.ok((await deleteRoot.execute(USER_ID)).isRight());
      const redelivered = await deleteMedia.execute(USER_ID);
      assert.ok(redelivered.isRight() && redelivered.value === 0);

      for (let pass = 0; pass < 3; pass += 1) {
        em.clear();
        await folderCleanup.execute();
      }

      assert.equal(await count('files', 'user_id = ?', [USER_ID]), 0);
      assert.equal(await count('images'), 0);
      assert.equal(await count('videos'), 0);
      assert.equal(await count('storage-objects', 'user_id = ?', [USER_ID]), 0);

      assert.equal(await exists('files', foreign.id), true);
      assert.equal(
        await count('storage-objects', 'user_id = ? and not is_deleted', [OTHER_USER_ID]),
        2,
      );

      assert.deepEqual(purgeKeys(purged), [
        `${FilePurgeType.FILE}:dev/image`,
        `${FilePurgeType.FILE}:dev/image.preview.webp`,
        `${FilePurgeType.FILE}:dev/placed`,
        `${FilePurgeType.FILE}:dev/unplaced`,
        `${FilePurgeType.FILE}:dev/unplaced-image`,
        `${FilePurgeType.VIDEO}:video-guid`,
      ]);
    },
  );

  describe('owner ids', () => {
    withDb('lists every file owner, and only owners of live storage objects', async () => {
      await placeFile(root, 'dev/placed');
      await fileRepository.saveAndPlaceOne({
        file: { ...fileMeta('dev/foreign'), userId: OTHER_USER_ID },
      });
      const otherRoot = em.create(PgStorageObjectEntity, {
        userId: OTHER_USER_ID,
        name: '',
        type: NestStorage.StorageObjectType.FOLDER,
        isFolder: true,
        isPublic: false,
      } as never);
      await em.persist(otherRoot).flush();
      await storageObjectRepository.markDeletedWithDescendants(otherRoot.id);

      em.clear();
      assert.deepEqual(
        (await fileRepository.getOwnerIds()).sort(),
        [USER_ID, OTHER_USER_ID].sort(),
      );
      assert.deepEqual(await storageObjectRepository.getLiveOwnerIds(), [USER_ID]);
    });
  });

  describe('isRoot', () => {
    withDb('finds the root folder only', async () => {
      await createFolder('a', root);

      em.clear();
      const roots = await storageObjectRepository.getMany({ userId: USER_ID, isRoot: true });
      const nonRoots = await storageObjectRepository.getMany({ userId: USER_ID, isRoot: false });

      assert.deepEqual(
        roots.map(({ id }) => id),
        [root],
      );
      assert.equal(nonRoots.length, 1);
    });
  });
});
