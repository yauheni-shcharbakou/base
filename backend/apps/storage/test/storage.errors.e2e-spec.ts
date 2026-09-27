import './pg.e2e';
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
import { ConflictException, HttpException, NotFoundException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { startOrm } from './pg.e2e';

const USER_ID = '01JQ0000000000000000000000';
const MISSING_ID = '01JQ0000000000000000000099';

/**
 * The admin panel shows a 4xx message exactly as the backend wrote it, so a miss must name the
 * resource, not the ORM class (`PgStorageObjectEntity`). Each repository is asserted on its own,
 * because the name is declared per repository and some override the paths that build the error.
 */
describe('storage repository errors against Postgres', () => {
  let orm: MikroORM | undefined;
  let fileRepository: PgFileRepositoryImpl;
  let imageRepository: PgImageRepositoryImpl;
  let videoRepository: PgVideoRepositoryImpl;
  let storageObjectRepository: PgStorageObjectRepositoryImpl;

  // In a hook, not in an async suite body: `node:test` reports an error thrown there but still
  // exits 0, which would turn a broken migration into a green run.
  before(async () => {
    orm = await startOrm({ database: 'errors' });

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

  after(() => orm?.close());

  beforeEach(async () => {
    if (!orm) {
      return;
    }

    await orm.schema.clear();
    // A failed flush leaves its entity in the unit of work, and the next flush would retry it.
    orm.em.clear();
  });

  // Skipped rather than failed without a server, like the Redis e2e suites.
  const withDb = (name: string, fn: () => Promise<void>) =>
    it(name, (t) => (orm ? fn() : t.skip('no Postgres — start one with `pnpm docker:local`')));

  const assertError = (
    result: Either<Error, unknown>,
    type: new (...args: never[]) => HttpException,
    message: string,
  ) => {
    assert.ok(result.isLeft(), 'expected a left');
    const error = result.value;
    assert.ok(error instanceof type, `expected a ${type.name}, got ${error}`);
    assert.equal(error.message, message);
  };

  describe('a miss names the resource', () => {
    const cases = [
      ['File', () => fileRepository],
      ['Image', () => imageRepository],
      ['Video', () => videoRepository],
      ['Storage object', () => storageObjectRepository],
    ] as const;

    for (const [name, repository] of cases) {
      withDb(`${name}: getById, updateById, deleteById`, async () => {
        const message = `${name} not found`;

        assertError(await repository().getById(MISSING_ID), NotFoundException, message);
        assertError(
          await repository().updateById(MISSING_ID, { set: {} }),
          NotFoundException,
          message,
        );
        assertError(await repository().deleteById(MISSING_ID), NotFoundException, message);
      });
    }

    withDb('Image: deleteWithFile', async () => {
      assertError(
        await imageRepository.deleteWithFile(MISSING_ID),
        NotFoundException,
        'Image not found',
      );
    });

    withDb('Video: deleteWithFile', async () => {
      assertError(
        await videoRepository.deleteWithFile(MISSING_ID),
        NotFoundException,
        'Video not found',
      );
    });

    withDb('Storage object: updateAndCascadePublic', async () => {
      assertError(
        await storageObjectRepository.updateAndCascadePublic(MISSING_ID, { set: {} }),
        NotFoundException,
        'Storage object not found',
      );
    });
  });

  // The unique root-folder index is the one constraint a client can hit through `saveOne`.
  withDb('a unique violation names the resource', async () => {
    const root = {
      userId: USER_ID,
      name: 'root',
      type: NestStorage.StorageObjectType.FOLDER,
      isFolder: true,
      isPublic: false,
    };

    assert.ok((await storageObjectRepository.saveOne(root)).isRight());
    orm.em.clear();

    assertError(
      await storageObjectRepository.saveOne(root),
      ConflictException,
      'Storage object already exists',
    );
  });
});
