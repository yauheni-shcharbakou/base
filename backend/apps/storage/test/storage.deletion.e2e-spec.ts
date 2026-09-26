import './pg.e2e';
import { FileEventBus, FilePurgeEvent, FilePurgeType } from '@backend/event-bus';
import { NestStorage } from '@backend/proto';
import { Config } from '@/config';
import { PgStorageObjectEntity } from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { PgFileEntity } from '@common/infrastructure/pg/entities/pg.file.entity';
import { PgImageEntity } from '@common/infrastructure/pg/entities/pg.image.entity';
import { PgVideoEntity } from '@common/infrastructure/pg/entities/pg.video.entity';
import { FilePurgeService } from '@modules/file/application/services/file.purge.service';
import { FileCleanupUseCase } from '@modules/file/application/use-cases/file.cleanup.use-case';
import { PgFileRepositoryImpl } from '@modules/file/infrastructure/pg/repositories/pg.file.repository.impl';
import { PgImageRepositoryImpl } from '@modules/image/infrastructure/pg/repositories/pg.image.repository.impl';
import { StorageObjectCleanupUseCase } from '@modules/storage-object/application/use-cases/storage-object.cleanup.use-case';
import { StorageObjectDeleteOneUseCase } from '@modules/storage-object/application/use-cases/storage-object.delete-one.use-case';
import { PgStorageObjectRepositoryImpl } from '@modules/storage-object/infrastructure/pg/repositories/pg.storage-object.repository.impl';
import { PgVideoRepositoryImpl } from '@modules/video/infrastructure/pg/repositories/pg.video.repository.impl';
import { EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { ConfigService } from '@nestjs/config';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { startOrm } from './pg.e2e';

const USER_ID = '01JQ0000000000000000000000';

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

  // In a hook, not in an async suite body: `node:test` reports an error thrown there but still
  // exits 0, which would turn a broken migration into a green run.
  before(async () => {
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

  after(() => orm?.close());

  // Skipped rather than failed without a server, like the Redis e2e suites.
  const withDb = (name: string, fn: () => Promise<void>) =>
    it(name, (t) => (orm ? fn() : t.skip('no Postgres — start one with `pnpm docker:local`')));

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

  const placement = (parent: string) => ({ name: 'object.bin', isPublic: false, parent });

  const placeFile = async (
    parent: string,
    providerId: string,
    status = NestStorage.FileUploadStatus.READY,
  ) => {
    const file = await fileRepository.saveAndPlaceOne({
      file: { ...fileMeta(providerId, status), userId: USER_ID, uploadId: 'upload' },
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
      image: { width: 1, height: 1, alt: '', userId: USER_ID, uploadId: 'upload' },
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
      video: { title: 'video', providerId, userId: USER_ID, uploadId: 'upload' },
      file: fileMeta(undefined, status),
      storageObject: placement(parent),
    });

    return video.unwrap();
  };

  const TTL_HOURS = 24;

  const fileCleanup = () =>
    new FileCleanupUseCase(fileRepository, filePurgeService, {
      getOrThrow: () => TTL_HOURS,
    } as unknown as ConfigService<Config>);

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
        // `parent_id` is `on delete set null`: a parent removed first would orphan its child
        // into a root.
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
      await placeImage(folder, 'dev/image');
      await placeVideo(folder, 'video-guid');
      await placeFile(nested, 'dev/nested');
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
        `${FilePurgeType.FILE}:dev/nested`,
        `${FilePurgeType.VIDEO}:video-guid`,
      ]);
    },
  );
});
