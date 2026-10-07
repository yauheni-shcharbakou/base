import { NestStorage } from '@backend/proto';
import { PgFileEntity } from '@common/infrastructure/pg/entities/pg.file.entity';
import { PgImageEntity } from '@common/infrastructure/pg/entities/pg.image.entity';
import { PgStorageObjectEntity } from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { PgVideoEntity } from '@common/infrastructure/pg/entities/pg.video.entity';
import { PgFileRepositoryImpl } from '@modules/file/infrastructure/pg/repositories/pg.file.repository.impl';
import { PgImageRepositoryImpl } from '@modules/image/infrastructure/pg/repositories/pg.image.repository.impl';
import { PgStorageObjectRepositoryImpl } from '@modules/storage-object/infrastructure/pg/repositories/pg.storage-object.repository.impl';
import { PgVideoRepositoryImpl } from '@modules/video/infrastructure/pg/repositories/pg.video.repository.impl';
import { MikroORM } from '@mikro-orm/postgresql';
import { Either } from '@sweet-monads/either';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { startOrm } from './pg.e2e';

const USER_ID = '01JQ0000000000000000000000';
const ITEMS = 100;
// Tens of milliseconds when only the contract is serialized; 30 s (images) and 60 s (videos) when
// the serializer walked each leaf's storage object into its folder and every sibling there.
const CEILING_MS = 5_000;

const fileMeta = (index: number) => ({
  originalName: `item-${index}.bin`,
  mimeType: 'application/octet-stream',
  size: 1,
  extension: 'bin',
  uploadStatus: NestStorage.FileUploadStatus.PENDING,
  providerId: `provider-${index}`,
});

/**
 * A batch of media placed in a folder the same EntityManager holds — a folder created earlier in
 * the request, say — must cost what the batch costs. The unit of work fills that folder's
 * `children` with every leaf it inserts, so a mapper that serializes a leaf's storage object walks
 * the whole folder for each item: n², and out of memory at a few hundred.
 */
describe('media written into a folder held by the same EntityManager', () => {
  let orm: MikroORM | undefined;
  let fileRepository: PgFileRepositoryImpl;
  let imageRepository: PgImageRepositoryImpl;
  let videoRepository: PgVideoRepositoryImpl;
  let storageObjectRepository: PgStorageObjectRepositoryImpl;

  // In a hook, not in the suite body, which Vitest collects synchronously and cannot await.
  beforeAll(async () => {
    orm = await startOrm({ database: 'media_serialization' });

    if (!orm) {
      return;
    }

    const { em } = orm;
    fileRepository = new PgFileRepositoryImpl(em.getRepository(PgFileEntity));
    imageRepository = new PgImageRepositoryImpl(em.getRepository(PgImageEntity));
    videoRepository = new PgVideoRepositoryImpl(em.getRepository(PgVideoEntity));
    storageObjectRepository = new PgStorageObjectRepositoryImpl(
      em.getRepository(PgStorageObjectEntity),
    );
  });

  afterAll(() => orm?.close());

  beforeEach(async () => {
    if (!orm) {
      return;
    }

    await orm.schema.clear();
    orm.em.clear();
  });

  // Skipped rather than failed without a server, like the Redis e2e suites.
  const withDb = (name: string, fn: () => Promise<void>) =>
    it(name, (t) => (orm ? fn() : t.skip('no Postgres — start one with `pnpm docker:db`')));

  // Left in the identity map on purpose: that is the folder whose `children` the batch fills.
  const createFolder = async () =>
    (
      await storageObjectRepository.saveOne({
        userId: USER_ID,
        name: '',
        type: NestStorage.StorageObjectType.FOLDER,
        isFolder: true,
        isPublic: false,
      })
    ).unwrap();

  const placement = (parent: string, index: number) => ({
    parent,
    name: `item-${index}.bin`,
    isPublic: false,
  });

  const timed = async <T>(write: () => Promise<Either<Error, T[]>>): Promise<T[]> => {
    const startedAt = performance.now();
    const rows = (await write()).unwrap();
    const elapsed = performance.now() - startedAt;

    assert.ok(elapsed < CEILING_MS, `${ITEMS} items took ${Math.round(elapsed)} ms`);
    assert.equal(rows.length, ITEMS);

    return rows;
  };

  // The contract has no `storageObject`, at any depth.
  const assertNoStorageObject = (row: object) =>
    assert.ok(
      !('storageObject' in row),
      `serialized a storage object: ${Object.keys(row).join(', ')}`,
    );

  withDb('files', async () => {
    const folder = await createFolder();

    const files = await timed(() =>
      fileRepository.saveAndPlaceMany(
        Array.from({ length: ITEMS }, (_, index) => ({
          file: { ...fileMeta(index), userId: USER_ID },
          storageObject: placement(folder.id, index),
        })),
      ),
    );

    files.forEach((file, index) => {
      assert.equal(file.originalName, `item-${index}.bin`);
      assertNoStorageObject(file);
    });
  });

  withDb('images', async () => {
    const folder = await createFolder();

    const images = await timed(() =>
      imageRepository.saveAndPlaceMany(
        Array.from({ length: ITEMS }, (_, index) => ({
          image: { userId: USER_ID, width: 1, height: 1, alt: `alt-${index}` },
          file: fileMeta(index),
          storageObject: placement(folder.id, index),
        })),
      ),
    );

    images.forEach((image, index) => {
      const { file } = image as NestStorage.ImagePopulated;

      assert.equal(image.alt, `alt-${index}`);
      assert.equal(image.fileId, file.id);
      assertNoStorageObject(image);
      assertNoStorageObject(file);
    });
  });

  withDb('videos', async () => {
    const folder = await createFolder();

    const videos = await timed(() =>
      videoRepository.saveAndPlaceMany(
        Array.from({ length: ITEMS }, (_, index) => ({
          video: { userId: USER_ID, title: `video-${index}`, providerId: `guid-${index}` },
          file: fileMeta(index),
          storageObject: placement(folder.id, index),
        })),
      ),
    );

    videos.forEach((video, index) => {
      const { file } = video as NestStorage.VideoPopulated;

      assert.equal(video.title, `video-${index}`);
      assert.equal(video.fileId, file.id);
      assertNoStorageObject(video);
      assertNoStorageObject(file);
    });
  });

  // A relation is an object only where the read populated it; the identity map has no say.
  withDb('a relation that is not loaded stays its key', async () => {
    const folder = await createFolder();

    const image = (
      await imageRepository.saveAndPlaceOne({
        image: { userId: USER_ID, width: 1, height: 1, alt: 'alt' },
        file: fileMeta(0),
        storageObject: placement(folder.id, 0),
      })
    ).unwrap();

    orm.em.clear();

    // `File` has no `image`/`video`; the row the mapper returns does.
    const [file] = (await fileRepository.getMany({ ids: [image.fileId] })) as unknown as Record<
      string,
      unknown
    >[];

    assert.equal(file.image, image.id);
    assert.equal(file.video ?? null, null);
    assertNoStorageObject(file);
  });
});
