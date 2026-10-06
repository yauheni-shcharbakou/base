import { NestCommon, NestStorage } from '@backend/proto';
import { PgFileEntity } from '@common/infrastructure/pg/entities/pg.file.entity';
import { PgImageEntity } from '@common/infrastructure/pg/entities/pg.image.entity';
import {
  MAX_FOLDER_DEPTH,
  PgStorageObjectEntity,
} from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { PgVideoEntity } from '@common/infrastructure/pg/entities/pg.video.entity';
import { PgFileRepositoryImpl } from '@modules/file/infrastructure/pg/repositories/pg.file.repository.impl';
import { PgImageRepositoryImpl } from '@modules/image/infrastructure/pg/repositories/pg.image.repository.impl';
import { StorageObjectValidationService } from '@modules/storage-object/application/services/storage-object.validation.service';
import { StorageObjectCreateFoldersUseCase } from '@modules/storage-object/application/use-cases/storage-object.create-folders.use-case';
import { StorageObjectCreateOneUseCase } from '@modules/storage-object/application/use-cases/storage-object.create-one.use-case';
import { StorageObjectDeleteManyUseCase } from '@modules/storage-object/application/use-cases/storage-object.delete-many.use-case';
import { StorageObjectDeleteOneUseCase } from '@modules/storage-object/application/use-cases/storage-object.delete-one.use-case';
import { StorageObjectGetFolderContentUseCase } from '@modules/storage-object/application/use-cases/storage-object.get-folder-content.use-case';
import { StorageObjectMoveManyUseCase } from '@modules/storage-object/application/use-cases/storage-object.move-many.use-case';
import { StorageObjectUpdateOneUseCase } from '@modules/storage-object/application/use-cases/storage-object.update-one.use-case';
import { StorageObjectUpdatePublicManyUseCase } from '@modules/storage-object/application/use-cases/storage-object.update-public-many.use-case';
import { PgStorageObjectRepositoryImpl } from '@modules/storage-object/infrastructure/pg/repositories/pg.storage-object.repository.impl';
import { StorageFileService } from '@modules/storage/domain/services/storage.file.service';
import { StorageVideoService } from '@modules/storage/domain/services/storage.video.service';
import { PgVideoRepositoryImpl } from '@modules/video/infrastructure/pg/repositories/pg.video.repository.impl';
import { EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import assert from 'node:assert/strict';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { setTimeout } from 'node:timers/promises';
import { startOrm } from './pg.e2e';

const USER_ID = '01JQ0000000000000000000001';
const OTHER_USER_ID = '01JQ0000000000000000000002';

// What the gRPC reads populate: the path next to the to-one media relations.
const POPULATE = ['file', 'image', 'video', 'folderPath'] as const;

/**
 * The folder tree lives in SQL — `folderPath` is a lazy formula over `parent_id`, and a folder's
 * `isPublic` reaches its subtree through one recursive `UPDATE` — so it is exercised against a real,
 * migrated database rather than a mocked repository.
 */
describe('storage-object tree against Postgres', () => {
  let orm: MikroORM | undefined;
  let em: EntityManager;
  let repository: PgStorageObjectRepositoryImpl;
  let updateOne: StorageObjectUpdateOneUseCase;
  let createOne: StorageObjectCreateOneUseCase;
  let deleteOne: StorageObjectDeleteOneUseCase;
  let deleteMany: StorageObjectDeleteManyUseCase;
  let moveMany: StorageObjectMoveManyUseCase;
  let updatePublicMany: StorageObjectUpdatePublicManyUseCase;
  let createFolders: StorageObjectCreateFoldersUseCase;
  let getFolderContent: StorageObjectGetFolderContentUseCase;
  let fileRepository: PgFileRepositoryImpl;
  let imageRepository: PgImageRepositoryImpl;
  let videoRepository: PgVideoRepositoryImpl;

  // Every statement the ORM sends; a spec resets it to measure what one call costs.
  let statements: string[] = [];

  // In a hook, not in the suite body, which Vitest collects synchronously and cannot await.
  beforeAll(async () => {
    orm = await startOrm({ database: 'tree', onQuery: (message) => statements.push(message) });

    if (!orm) {
      return;
    }

    em = orm.em;
    repository = new PgStorageObjectRepositoryImpl(em.getRepository(PgStorageObjectEntity));
    const validation = new StorageObjectValidationService(repository);
    updateOne = new StorageObjectUpdateOneUseCase(repository, validation);
    createOne = new StorageObjectCreateOneUseCase(repository, validation);
    deleteOne = new StorageObjectDeleteOneUseCase(repository);
    deleteMany = new StorageObjectDeleteManyUseCase(repository, validation);
    moveMany = new StorageObjectMoveManyUseCase(repository, validation);
    updatePublicMany = new StorageObjectUpdatePublicManyUseCase(repository, validation);
    createFolders = new StorageObjectCreateFoldersUseCase(repository, validation);
    // The Bunny signers read their keys from the env; these stubs keep the signed key readable.
    const fileSigner = {
      getFileSignedUrl: (providerId: string) => right(`https://storage.test/${providerId}`),
    } as unknown as StorageFileService;
    const videoSigner = {
      getThumbnailUrl: (guid: string) => right(`https://stream.test/${guid}/thumbnail.jpg`),
    } as unknown as StorageVideoService;
    getFolderContent = new StorageObjectGetFolderContentUseCase(
      repository,
      fileSigner,
      videoSigner,
    );
    fileRepository = new PgFileRepositoryImpl(em.getRepository(PgFileEntity));
    imageRepository = new PgImageRepositoryImpl(em.getRepository(PgImageEntity));
    videoRepository = new PgVideoRepositoryImpl(em.getRepository(PgVideoEntity));
  });

  afterAll(() => orm?.close());

  // Skipped rather than failed without a server, like the Redis e2e suites. The timeout turns a
  // recursion that never ends into a failure instead of a hung run.
  const withDb = (name: string, fn: () => Promise<void>) =>
    it(name, { timeout: 30_000 }, (t) =>
      orm ? fn() : t.skip('no Postgres — start one with `pnpm docker:db`'),
    );

  let root: string;

  beforeEach(async () => {
    if (!orm) {
      return;
    }

    await orm.schema.clear();
    root = await createObject({ name: '' });
  });

  const createObject = async ({
    name,
    parent,
    isFolder = true,
    userId = USER_ID,
  }: {
    name: string;
    parent?: string;
    isFolder?: boolean;
    userId?: string;
  }): Promise<string> => {
    const object = em.create(PgStorageObjectEntity, {
      userId,
      name,
      type: isFolder ? NestStorage.StorageObjectType.FOLDER : NestStorage.StorageObjectType.FILE,
      isFolder,
      isPublic: false,
      ...(parent ? { parent } : {}),
    } as never);

    await em.persist(object).flush();
    return object.id;
  };

  // An unplaced file of the owner, for a leaf created over existing media.
  const createFile = async (): Promise<string> => {
    const file = em.create(PgFileEntity, {
      userId: USER_ID,
      originalName: 'a.txt',
      mimeType: 'text/plain',
      size: 1,
      extension: 'txt',
      uploadStatus: NestStorage.FileUploadStatus.READY,
    } as never);

    await em.persist(file).flush();
    return file.id;
  };

  const createFolder = (name: string, parent: string) => createObject({ name, parent });
  const createLeaf = (parent: string) =>
    createObject({ name: 'object.bin', parent, isFolder: false });

  // A fresh identity map for every read: an entity cached earlier would come back as it was cached,
  // with or without the lazy formula, instead of as the statement under test returns it.
  const read = async <T>(fn: () => Promise<T>): Promise<T> => {
    em.clear();
    return fn();
  };

  const paths = async (ids: string[]): Promise<Map<string, string | null>> => {
    const items = await read(() =>
      repository.getMany<NestStorage.StorageObjectPopulated>({ ids }, { populate: ['folderPath'] }),
    );
    return new Map(items.map((item) => [item.id, item.folderPath ?? null]));
  };

  const publicIds = async (): Promise<string[]> => {
    const items = await read(() => repository.getMany({ userId: USER_ID, isPublic: true }));
    return items.map((item) => item.id).sort();
  };

  const countStatements = async (fn: () => Promise<unknown>): Promise<number> => {
    em.clear();
    statements = [];
    await fn();
    return statements.length;
  };

  // Takes the tree lock and keeps it until `release` — so a spec can line writes up behind it and
  // know they are queued, not merely started. Release it in a `finally`: a failed assertion that
  // leaves the transaction open hangs the run on closing the pool instead of failing it.
  const holdTreeLock = async (userId = USER_ID) => {
    let entered!: () => void;
    let open!: () => void;
    const inside = new Promise<void>((resolve) => (entered = resolve));
    const gate = new Promise<void>((resolve) => (open = resolve));

    const done = repository.withTreeLock(userId, async () => {
      entered();
      await gate;
      return right(undefined);
    });

    await inside;

    return {
      release: async () => {
        open();
        await done;
      },
    };
  };

  // Seen from outside, through `pg_locks`: the advisory locks this database waits for.
  const untilQueued = async (count: number): Promise<void> => {
    for (let attempt = 0; attempt < 500; attempt++) {
      const [row] = await em.getConnection().execute<{ waiting: number }[]>(
        `select count(*)::int as waiting from pg_locks
         where locktype = 'advisory' and not granted
           and database = (select oid from pg_database where datname = current_database())`,
      );

      if (row.waiting === count) {
        return;
      }

      await setTimeout(10);
    }

    assert.fail(`${count} tree writes never queued on the lock`);
  };

  const byId = (id: string): NestStorage.StorageObjectQuery => ({ id, ids: [] });

  const createRequest = (
    name: string,
    parent: string,
    type = NestStorage.StorageObjectType.FOLDER,
  ): NestStorage.StorageObjectCreate => ({ name, parent, type, userId: USER_ID, isPublic: false });

  describe('folderPath', () => {
    withDb('derives every path from the tree: root, nested folders, none for a leaf', async () => {
      const docs = await createFolder('docs', root);
      const drafts = await createFolder('drafts', docs);
      const leaf = await createLeaf(drafts);

      const result = await paths([root, docs, drafts, leaf]);

      assert.equal(result.get(root), '/');
      assert.equal(result.get(docs), '/docs/');
      assert.equal(result.get(drafts), '/docs/drafts/');
      assert.equal(result.get(leaf), null);
    });

    withDb('fills the path through getOne and getList the same way', async () => {
      const docs = await createFolder('docs', root);
      const drafts = await createFolder('drafts', docs);

      const one = await read(() =>
        repository.getOne<NestStorage.StorageObjectPopulated>(
          { id: drafts },
          { populate: ['folderPath'] },
        ),
      );
      const list = await read(() =>
        repository.getList<NestStorage.StorageObjectPopulated>(
          { query: { userId: USER_ID }, pagination: { page: 1, limit: 10 } },
          { populate: ['folderPath'] },
        ),
      );

      assert.equal(one.unwrap().folderPath, '/docs/drafts/');
      assert.deepEqual(
        new Map(list.items.map((item) => [item.id, item.folderPath])),
        new Map([
          [root, '/'],
          [docs, '/docs/'],
          [drafts, '/docs/drafts/'],
        ]),
      );
    });

    withDb('computes nothing when the read does not ask for the path', async () => {
      const docs = await createFolder('docs', root);

      const folder = await read(() => repository.getOne({ id: docs }));

      assert.equal(folder.unwrap().folderPath, undefined);
    });

    // Nothing is cascaded: the subtree's rows are not written, their paths just read differently.
    withDb('follows a rename and a move at once, without writing the subtree', async () => {
      const docs = await createFolder('docs', root);
      const drafts = await createFolder('drafts', docs);
      const old = await createFolder('old', drafts);
      // As text, so the comparison keeps the column's microseconds.
      const writtenAt = async () => {
        const [row] = await em
          .getConnection()
          .execute<{ written_at: string }[]>(
            'select updated_at::text as written_at from "storage-objects" where id = ?',
            [old],
          );
        return row.written_at;
      };
      const before = await writtenAt();

      await repository.updateById(docs, { set: { name: 'papers' } });
      assert.equal((await paths([old])).get(old), '/papers/drafts/old/');

      await repository.updateAndCascadePublic(drafts, { set: { parent: root } });
      assert.deepEqual(
        await paths([drafts, old]),
        new Map([
          [drafts, '/drafts/'],
          [old, '/drafts/old/'],
        ]),
      );

      assert.equal(await writtenAt(), before, 'the subtree row was never written');
    });

    // The formula rides in the main SELECT and the media relations are to-one joins, so the number
    // of statements must not grow with the number of rows — that is what an N+1 would break.
    withDb(
      'reads a page in the same number of statements however many folders it holds',
      async () => {
        const cost = async () => ({
          many: await countStatements(() =>
            repository.getMany<NestStorage.StorageObjectPopulated>(
              { userId: USER_ID },
              { populate: [...POPULATE] },
            ),
          ),
          list: await countStatements(() =>
            repository.getList<NestStorage.StorageObjectPopulated>(
              { query: { userId: USER_ID }, pagination: { page: 1, limit: 100 } },
              { populate: [...POPULATE, 'folderStats'] },
            ),
          ),
        });

        // Three folders deep plus a leaf per chain, so most rows walk up more than one step.
        let chainCount = 0;
        const grow = async (chains: number) => {
          for (let n = 0; n < chains; n++, chainCount++) {
            const a = await createFolder(`a${chainCount}`, root);
            const b = await createFolder(`b${chainCount}`, a);
            await createLeaf(await createFolder(`c${chainCount}`, b));
          }
        };

        await grow(1);
        const small = await cost();

        await grow(15);
        const large = await cost();

        // getMany is one SELECT; getList adds its COUNT.
        assert.deepEqual(small, { many: 1, list: 2 });
        assert.deepEqual(large, small);

        const deepest = await read(() =>
          repository.getOne<NestStorage.StorageObjectPopulated>(
            { name: 'c15' },
            { populate: ['folderPath'] },
          ),
        );
        assert.equal(deepest.unwrap().folderPath, '/a15/b15/c15/');
      },
    );
  });

  describe('updateAndCascadePublic', () => {
    withDb('writes a folder’s visibility over its whole subtree, both ways', async () => {
      const docs = await createFolder('docs', root);
      const drafts = await createFolder('drafts', docs);
      const leaf = await createLeaf(drafts);
      const sibling = await createFolder('sibling', root);

      const updated = await repository.updateAndCascadePublic(docs, { set: { isPublic: true } });

      assert.equal(updated.unwrap().isPublic, true);
      assert.deepEqual(await publicIds(), [docs, drafts, leaf].sort());

      // `false` has to travel as far as `true` does.
      await repository.updateAndCascadePublic(docs, { set: { isPublic: false } });

      assert.deepEqual(await publicIds(), []);
      assert.equal((await paths([sibling])).get(sibling), '/sibling/');
    });

    withDb('leaves the subtree alone when the folder’s visibility does not change', async () => {
      const docs = await createFolder('docs', root);
      const drafts = await createFolder('drafts', docs);

      await repository.updateAndCascadePublic(drafts, { set: { isPublic: true } });
      await repository.updateAndCascadePublic(docs, { set: { isPublic: false, name: 'papers' } });

      assert.deepEqual(await publicIds(), [drafts]);
    });

    withDb('reports a missing object as not found and writes nothing', async () => {
      const result = await repository.updateAndCascadePublic('01JQ00000000000000000MISSING', {
        set: { isPublic: true },
      });

      assert.equal(result.isLeft(), true);
      assert.deepEqual(await publicIds(), []);
    });
  });

  // Through the use case and the real queries: the name check once matched the object itself.
  describe('rename and move', () => {
    const createFile = (name: string, parent: string) =>
      createObject({ name, parent, isFolder: false });

    withDb('renames a folder and a file to the names they were given', async () => {
      const docs = await createFolder('docs', root);
      const file = await createFile('a.txt', docs);

      const folderRenamed = await updateOne.execute(byId(docs), { set: { name: 'papers' } });
      const fileRenamed = await updateOne.execute(byId(file), { set: { name: 'b.txt' } });

      assert.equal(folderRenamed.unwrap().name, 'papers');
      assert.equal(fileRenamed.unwrap().name, 'b.txt');
    });

    withDb('refuses a name the folder already has on a rename in place', async () => {
      const docs = await createFolder('docs', root);
      await createFile('b.txt', docs);
      const file = await createFile('a.txt', docs);

      const renamed = await updateOne.execute(byId(file), { set: { name: 'b.txt' } });

      assert.ok(renamed.isLeft() && renamed.value instanceof ConflictException);
    });

    // A move never fails on a name: a folder takes its suffix after the whole name, a file before
    // its extension.
    withDb('suffixes a name the target folder already has on a move', async () => {
      const docs = await createFolder('docs', root);
      const archive = await createFolder('archive', root);
      await createFolder('docs', archive);
      await createFile('a.txt', archive);
      const file = await createFile('a.txt', docs);

      const movedFile = await updateOne.execute(byId(file), { set: { parent: archive } });
      const movedFolder = await updateOne.execute(byId(docs), { set: { parent: archive } });

      assert.equal(movedFile.unwrap().name, 'a (1).txt');
      assert.equal(movedFolder.unwrap().name, 'docs (1)');
      assert.equal((await paths([docs])).get(docs), '/archive/docs (1)/');
    });

    withDb('frees the name of a deleted object at once', async () => {
      const docs = await createFolder('docs', root);
      const drafts = await createFolder('drafts', root);
      await repository.markDeletedWithDescendants(docs);

      const renamed = await updateOne.execute(byId(drafts), { set: { name: 'docs' } });

      assert.equal(renamed.unwrap().name, 'docs');
    });
  });

  // Several objects of one owner in one call, under one lock: all or none.
  describe('batch move and delete', () => {
    const createFile = (name: string, parent: string) =>
      createObject({ name, parent, isFolder: false });

    const names = async (parent: string): Promise<string[]> => {
      const items = await read(() => repository.getMany({ parent, isDeleted: false }));
      return items.map((item) => item.name).sort();
    };

    withDb('moves objects from different folders, suffixing each clash in order', async () => {
      const left1 = await createFolder('left', root);
      const right1 = await createFolder('right', root);
      const target = await createFolder('target', root);
      await createFile('a.txt', target);
      const a1 = await createFile('a.txt', left1);
      const a2 = await createFile('a.txt', right1);
      const docs = await createFolder('docs', left1);
      await createFolder('inner', docs);

      const moved = await moveMany.execute({ ids: [a1, a2, docs], parent: target });

      assert.deepEqual(
        moved.unwrap().map((item) => item.name),
        ['a (1).txt', 'a (2).txt', 'docs'],
      );
      assert.deepEqual(await names(target), ['a (1).txt', 'a (2).txt', 'a.txt', 'docs']);
      assert.equal((await paths([docs])).get(docs), '/target/docs/');
    });

    withDb('spreads the target’s visibility over every moved subtree', async () => {
      const target = await createFolder('target', root);
      await repository.updateAndCascadePublic(target, { set: { isPublic: true } });
      const docs = await createFolder('docs', root);
      const inner = await createFolder('inner', docs);
      const file = await createFile('a.txt', root);

      await moveMany.execute({ ids: [docs, file], parent: target });

      assert.deepEqual(await publicIds(), [target, docs, inner, file].sort());
    });

    withDb('refuses a target inside a moved folder and writes nothing', async () => {
      const docs = await createFolder('docs', root);
      const inner = await createFolder('inner', docs);
      const file = await createFile('a.txt', root);

      const moved = await moveMany.execute({ ids: [file, docs], parent: inner });

      assert.ok(moved.isLeft() && moved.value instanceof BadRequestException);
      assert.deepEqual(await names(root), ['a.txt', 'docs']);
    });

    // The lock's transaction rolls the objects written before a failure back with it.
    withDb('rolls the whole batch back when one object cannot be written', async () => {
      const target = await createFolder('target', root);
      const file = await createFile('a.txt', root);
      const docs = await createFolder('docs', root);
      // Past the service's checks, the unique index refuses the second write.
      const original = repository.updateAndCascadePublic.bind(repository);
      let calls = 0;
      repository.updateAndCascadePublic = (id, update) =>
        ++calls === 2
          ? original(id, { set: { ...update.set, name: 'a.txt' } })
          : original(id, update);

      try {
        const moved = await moveMany.execute({ ids: [file, docs], parent: target });
        assert.ok(moved.isLeft() && moved.value instanceof ConflictException);
      } finally {
        repository.updateAndCascadePublic = original;
      }

      assert.deepEqual(await names(target), []);
      assert.deepEqual(await names(root), ['a.txt', 'docs', 'target']);
    });

    withDb('refuses objects of another owner, in the batch or as the target', async () => {
      const otherRoot = await createObject({ name: '', userId: OTHER_USER_ID });
      const foreign = await createObject({ name: 'x', parent: otherRoot, userId: OTHER_USER_ID });
      const docs = await createFolder('docs', root);

      const mixed = await moveMany.execute({ ids: [docs, foreign], parent: root });
      const intoForeign = await moveMany.execute({ ids: [docs], parent: otherRoot });
      const scoped = await deleteMany.execute({ ids: [foreign], userId: USER_ID });

      assert.ok(mixed.isLeft() && mixed.value instanceof BadRequestException);
      assert.ok(intoForeign.isLeft() && intoForeign.value instanceof NotFoundException);
      assert.ok(scoped.isLeft() && scoped.value instanceof NotFoundException);
    });

    withDb('marks several subtrees deleted in one statement', async () => {
      const docs = await createFolder('docs', root);
      const inner = await createFolder('inner', docs);
      const leaf = await createFile('a.txt', inner);
      const file = await createFile('b.txt', root);
      await createFile('c.txt', root);

      const marked = await repository.markManyDeletedWithDescendants([docs, file]);
      const deleted = await read(() => repository.getMany({ userId: USER_ID, isDeleted: true }));

      assert.equal(marked.unwrap(), 4);
      assert.deepEqual(deleted.map(({ id }) => id).sort(), [docs, inner, leaf, file].sort());
      assert.deepEqual(await names(root), ['c.txt']);
    });

    withDb('deletes a batch with the root folder in it not at all', async () => {
      const docs = await createFolder('docs', root);

      const deleted = await deleteMany.execute({ ids: [docs, root] });

      assert.ok(deleted.isLeft() && deleted.value instanceof BadRequestException);
      assert.deepEqual(await names(root), ['docs']);
    });
  });

  // A public folder holds nothing private, on an edit as on a create; a batch is all or none.
  describe('visibility', () => {
    withDb('refuses to make an object in a public folder private in place', async () => {
      const docs = await createFolder('docs', root);
      const leaf = await createLeaf(docs);
      await repository.updateAndCascadePublic(docs, { set: { isPublic: true } });

      const refused = await updateOne.execute(byId(leaf), { set: { isPublic: false } });
      const folderMadePrivate = await updateOne.execute(byId(docs), { set: { isPublic: false } });

      assert.ok(refused.isLeft() && refused.value instanceof BadRequestException);
      // The folder itself sits in the private root: it goes private, and its content with it.
      assert.equal(folderMadePrivate.unwrap().isPublic, false);
      assert.deepEqual(await publicIds(), []);
    });

    withDb('makes several objects public at once, each folder with its subtree', async () => {
      const docs = await createFolder('docs', root);
      const inner = await createFolder('inner', docs);
      const leaf = await createLeaf(inner);
      const file = await createObject({ name: 'a.txt', parent: root, isFolder: false });
      await createFolder('other', root);

      const updated = await updatePublicMany.execute({ ids: [docs, file], isPublic: true });

      assert.deepEqual(
        updated.unwrap().map(({ id, isPublic }) => [id, isPublic]),
        [
          [docs, true],
          [file, true],
        ],
      );
      assert.deepEqual(await publicIds(), [docs, inner, leaf, file].sort());
    });

    withDb(
      'makes private an object whose public folder goes private in the same call',
      async () => {
        const docs = await createFolder('docs', root);
        const inner = await createFolder('inner', docs);
        await repository.updateAndCascadePublic(docs, { set: { isPublic: true } });

        const refused = await updatePublicMany.execute({ ids: [inner], isPublic: false });
        const together = await updatePublicMany.execute({ ids: [inner, docs], isPublic: false });

        assert.ok(refused.isLeft() && refused.value instanceof BadRequestException);
        assert.equal(together.isRight(), true);
        assert.deepEqual(await publicIds(), []);
      },
    );

    withDb('rolls the whole batch back when one object cannot be written', async () => {
      const docs = await createFolder('docs', root);
      const file = await createObject({ name: 'a.txt', parent: root, isFolder: false });
      await createObject({ name: 'b.txt', parent: root, isFolder: false });
      // Past the service's checks, the unique index refuses the second write.
      const original = repository.updateAndCascadePublic.bind(repository);
      let calls = 0;
      repository.updateAndCascadePublic = (id, update) =>
        ++calls === 2
          ? original(id, { set: { ...update.set, name: 'b.txt' } })
          : original(id, update);

      try {
        const updated = await updatePublicMany.execute({ ids: [docs, file], isPublic: true });
        assert.ok(updated.isLeft() && updated.value instanceof ConflictException);
      } finally {
        repository.updateAndCascadePublic = original;
      }

      assert.deepEqual(await publicIds(), []);
    });

    withDb('refuses objects of another owner', async () => {
      const otherRoot = await createObject({ name: '', userId: OTHER_USER_ID });
      const foreign = await createObject({ name: 'x', parent: otherRoot, userId: OTHER_USER_ID });
      const docs = await createFolder('docs', root);

      const mixed = await updatePublicMany.execute({ ids: [docs, foreign], isPublic: true });
      const scoped = await updatePublicMany.execute({
        ids: [foreign],
        isPublic: true,
        userId: USER_ID,
      });

      assert.ok(mixed.isLeft() && mixed.value instanceof BadRequestException);
      assert.ok(scoped.isLeft() && scoped.value instanceof NotFoundException);
      assert.deepEqual(await publicIds(), []);
    });
  });

  describe('folder tree create', () => {
    withDb('makes a whole tree, suffixing only a top-level name taken in the target', async () => {
      await createFolder('img', root);

      const created = await createFolders.execute({
        userId: USER_ID,
        parent: root,
        paths: ['img', 'img/2024', 'img/2024/may', 'docs'],
      });
      const ids = created.unwrap().map(({ id }) => id);
      const byId = await paths(ids);

      assert.deepEqual(
        ids.map((id) => byId.get(id)),
        ['/img (1)/', '/img (1)/2024/', '/img (1)/2024/may/', '/docs/'],
      );
    });

    withDb('makes the tree public under a public target', async () => {
      const target = await createFolder('target', root);
      await repository.updateAndCascadePublic(target, { set: { isPublic: true } });

      const created = await createFolders.execute({
        userId: USER_ID,
        parent: target,
        paths: ['a', 'a/b'],
      });

      assert.deepEqual(await publicIds(), [target, ...created.unwrap().map(({ id }) => id)].sort());
    });

    withDb('makes nothing under another owner’s folder', async () => {
      const otherRoot = await createObject({ name: '', userId: OTHER_USER_ID });

      const created = await createFolders.execute({
        userId: USER_ID,
        parent: otherRoot,
        paths: ['a'],
      });
      const theirs = await read(() => repository.getMany({ parent: otherRoot }));

      assert.ok(created.isLeft() && created.value instanceof NotFoundException);
      assert.deepEqual(theirs, []);
    });

    // The lock's transaction rolls the levels saved before a failure back with them.
    withDb('rolls the whole tree back when a level cannot be saved', async () => {
      const original = repository.saveMany.bind(repository);
      let calls = 0;
      repository.saveMany = (rows) =>
        ++calls === 2 ? Promise.resolve(left(new Error('write failed'))) : original(rows);

      try {
        const created = await createFolders.execute({
          userId: USER_ID,
          parent: root,
          paths: ['a', 'a/b'],
        });
        assert.ok(created.isLeft());
      } finally {
        repository.saveMany = original;
      }

      const children = await read(() => repository.getMany({ parent: root }));
      assert.deepEqual(children, []);
    });
  });

  describe('withTreeLock', () => {
    withDb('queues a second tree write until the first one ends', async () => {
      const first = await holdTreeLock();
      let secondRan = false;

      const second = repository.withTreeLock(USER_ID, () => {
        secondRan = true;
        return Promise.resolve(right(undefined));
      });

      try {
        await untilQueued(1);
        assert.equal(secondRan, false);
      } finally {
        await first.release();
      }

      await second;
      assert.equal(secondRan, true);
    });

    // The race the lock exists for: checked side by side, both moves would find the other folder
    // outside their subtree, and together they would close a cycle.
    withDb('lets one of two opposite moves through and refuses the other', async () => {
      const a = await createFolder('a', root);
      const b = await createFolder('b', root);

      const lock = await holdTreeLock();
      const moves = Promise.all([
        updateOne.execute(byId(a), { set: { parent: b } }),
        updateOne.execute(byId(b), { set: { parent: a } }),
      ]);

      try {
        // Both queued before either has read the tree.
        await untilQueued(2);
      } finally {
        await lock.release();
      }

      const results = await moves;
      const tree = await paths([a, b]);

      assert.equal(results.filter((result) => result.isRight()).length, 1);
      assert.ok(results.find((result) => result.isLeft())?.value instanceof BadRequestException);
      assert.ok(
        (tree.get(a) === '/b/a/' && tree.get(b) === '/b/') ||
          (tree.get(a) === '/a/' && tree.get(b) === '/a/b/'),
        `one folder ends up inside the other, got ${JSON.stringify([...tree])}`,
      );
    });

    withDb('rolls back what the work wrote when it returns a left', async () => {
      const docs = await createFolder('docs', root);

      const result = await repository.withTreeLock(USER_ID, async () => {
        await repository.updateAndCascadePublic(docs, { set: { isPublic: true } });
        return left(new Error('refused after the write'));
      });

      assert.equal(result.isLeft() && result.value.message, 'refused after the write');
      assert.deepEqual(await publicIds(), []);
    });
  });

  // A user's tree is closed: nothing is created in, or moved into, another user's folder — by the
  // service's checks, and by the database for a row written any other way.
  describe('owner', () => {
    let otherRoot: string;

    beforeEach(async () => {
      if (!orm) {
        return;
      }

      otherRoot = await createObject({ name: '', userId: OTHER_USER_ID });
    });

    withDb('refuses to move an object into another user’s folder', async () => {
      const docs = await createFolder('docs', root);

      const moved = await updateOne.execute(byId(docs), { set: { parent: otherRoot } });

      assert.ok(moved.isLeft() && moved.value instanceof NotFoundException);
      assert.equal((await paths([docs])).get(docs), '/docs/');
    });

    withDb('refuses to create an object in another user’s folder', async () => {
      const created = await createOne.execute(createRequest('docs', otherRoot));

      assert.ok(created.isLeft() && created.value instanceof NotFoundException);
      assert.equal(await read(() => repository.count({ parent: otherRoot })), 0);
    });

    // Placement once accepted a deleted parent: the object stayed live under it, where nothing
    // shows it and the folder cleanup never removes its folder.
    withDb('refuses a deleted folder as a parent, for a create and for a move', async () => {
      const trash = await createFolder('trash', root);
      const docs = await createFolder('docs', root);
      await repository.markDeletedWithDescendants(trash);

      const created = await createOne.execute(createRequest('new', trash));
      const moved = await updateOne.execute(byId(docs), { set: { parent: trash } });

      assert.ok(created.isLeft() && created.value instanceof NotFoundException);
      assert.ok(moved.isLeft() && moved.value instanceof NotFoundException);
    });

    // A public folder makes its content public; in a private one the caller chooses.
    withDb(
      'makes a new object public in a public folder, or when asked in a private one',
      async () => {
        const asked = await createOne.execute({ ...createRequest('asked', root), isPublic: true });
        const privateOne = await createOne.execute(createRequest('private', root));
        await repository.updateAndCascadePublic(root, { set: { isPublic: true } });
        const inherited = await createOne.execute(createRequest('inherited', root));

        assert.equal(asked.unwrap().isPublic, true);
        assert.equal(privateOne.unwrap().isPublic, false);
        assert.equal(inherited.unwrap().isPublic, true);
      },
    );

    // One rule for both kinds: a file's name takes a folder's, and a folder's a file's.
    withDb('refuses a folder named like a file in the same folder', async () => {
      await createObject({ name: 'docs', parent: root, isFolder: false });

      const created = await createOne.execute(createRequest('docs', root));

      assert.ok(created.isLeft() && created.value instanceof ConflictException);
    });

    withDb('checks a name only against the owner’s own objects', async () => {
      await createObject({ name: 'docs', parent: otherRoot, userId: OTHER_USER_ID });

      const created = await createOne.execute(createRequest('docs', root));

      assert.equal(created.unwrap().name, 'docs');
    });

    withDb(
      'the database refuses a parent of another owner, however the row is written',
      async () => {
        const docs = await createFolder('docs', root);

        await assert.rejects(
          em
            .getConnection()
            .execute('update "storage-objects" set parent_id = ? where id = ?', [otherRoot, docs]),
          /storage-objects_parent_owner_foreign/,
        );
      },
    );
  });

  describe('database constraints', () => {
    withDb('refuse a second live object of one name in a folder, whatever its kind', async () => {
      await createFolder('docs', root);

      await assert.rejects(createFolder('docs', root), /storage-objects_name_unique/);
      em.clear();
      await assert.rejects(
        createObject({ name: 'docs', parent: root, isFolder: false }),
        /storage-objects_name_unique/,
      );
    });

    withDb('free a deleted object’s name at once', async () => {
      const file = await createObject({ name: 'docs', parent: root, isFolder: false });
      await repository.markDeletedWithDescendants(file);

      await createFolder('docs', root);
    });

    // Past the service's check, the index still answers a rename onto a taken name — as the same
    // conflict the check gives, not as a server error.
    withDb('answer a write past the name check with a conflict', async () => {
      await createFolder('docs', root);
      const drafts = await createFolder('drafts', root);

      const renamed = await repository.updateAndCascadePublic(drafts, { set: { name: 'docs' } });

      assert.ok(renamed.isLeft() && renamed.value instanceof ConflictException);
    });

    // `no action`, not `set null`: a parent deleted first used to turn its child into a root.
    withDb('refuse to delete a folder that still has a child', async () => {
      const docs = await createFolder('docs', root);
      await createFolder('drafts', docs);

      await assert.rejects(
        em.getConnection().execute('delete from "storage-objects" where id = ?', [docs]),
        /storage-objects_parent_owner_foreign/,
      );
    });

    withDb('refuse a name holding a slash, which would read as two levels', async () => {
      await assert.rejects(createFolder('a/b', root), /storage-objects_name_check/);
    });
  });

  // The lock is per owner: the same key queues, another owner's never does.
  describe('tree lock per owner', () => {
    withDb('does not hold one owner’s write behind another’s', async () => {
      const lock = await holdTreeLock(USER_ID);

      try {
        const other = await Promise.race([
          repository.withTreeLock(OTHER_USER_ID, () => Promise.resolve(right('ran'))),
          setTimeout(5_000, left(new Error('queued behind another owner'))),
        ]);

        assert.equal(other.unwrap(), 'ran');
      } finally {
        await lock.release();
      }
    });

    // Queued behind the deletion of its parent, a create finds the parent gone instead of placing
    // a live object under a deleted folder.
    withDb('refuses a create queued behind the deletion of its parent', async () => {
      const docs = await createFolder('docs', root);
      const lock = await holdTreeLock();

      const deleted = deleteOne.execute({ id: docs });
      let created: ReturnType<typeof createOne.execute>;

      try {
        await untilQueued(1);
        created = createOne.execute(createRequest('drafts', docs));
        await untilQueued(2);
      } finally {
        await lock.release();
      }

      assert.equal((await deleted).isRight(), true);
      const result = await created;
      assert.ok(result.isLeft() && result.value instanceof NotFoundException);
    });

    withDb('gives two creates of one file name two names', async () => {
      const files = [await createFile(), await createFile()];
      const lock = await holdTreeLock();

      const creates = Promise.all(
        files.map((file) =>
          createOne.execute({
            ...createRequest('a.txt', root, NestStorage.StorageObjectType.FILE),
            file,
          }),
        ),
      );

      try {
        await untilQueued(2);
      } finally {
        await lock.release();
      }

      const names = (await creates).map((result) => result.unwrap().name).sort();
      assert.deepEqual(names, ['a (1).txt', 'a.txt']);
    });
  });

  // A folder view: the folder, the folders above it and a page of what it holds, read through the
  // use case so the scope, the order and the populates are the ones a client gets.
  describe('folder content', () => {
    const { CREATED_AT, NAME } = NestStorage.StorageObjectSortField;

    let placed = 0;
    const fileMeta = (providerId?: string) => ({
      originalName: 'object.bin',
      mimeType: 'application/octet-stream',
      size: 1,
      extension: 'bin',
      uploadStatus: NestStorage.FileUploadStatus.READY,
      providerId,
    });
    const placement = (name: string, parent: string) => ({ name, isPublic: false, parent });

    const placeFile = async (name: string, parent = root) => {
      const file = await fileRepository.saveAndPlaceOne({
        file: { ...fileMeta(`file-${++placed}`), userId: USER_ID },
        storageObject: placement(name, parent),
      });

      return file.unwrap();
    };

    // A plain file a first-page preview is made for.
    const placePdf = async (name: string, uploadStatus = NestStorage.FileUploadStatus.READY) => {
      const file = await fileRepository.saveAndPlaceOne({
        file: {
          ...fileMeta(`file-${++placed}`),
          mimeType: 'application/pdf',
          extension: 'pdf',
          uploadStatus,
          userId: USER_ID,
        },
        storageObject: placement(name, root),
      });

      return file.unwrap();
    };

    const placeImage = async (name: string, parent = root) => {
      const image = await imageRepository.saveAndPlaceOne({
        image: { width: 2, height: 3, alt: '', userId: USER_ID },
        file: fileMeta(`image-${++placed}`),
        storageObject: placement(name, parent),
      });

      return image.unwrap();
    };

    // A video's Stream guid sits on the video row; its backing file row carries none.
    const placeVideo = async (name: string, parent = root) => {
      const video = await videoRepository.saveAndPlaceOne({
        video: { title: 'video', providerId: `video-${++placed}`, userId: USER_ID },
        file: fileMeta(),
        storageObject: placement(name, parent),
      });

      return video.unwrap();
    };

    const createNamedLeaf = (name: string, parent = root) =>
      createObject({ name, parent, isFolder: false });

    const content = (request: Partial<NestStorage.StorageObjectGetFolderContent> = {}) =>
      read(() =>
        getFolderContent.execute({ parentId: root, userId: USER_ID, sorters: [], ...request }),
      );

    const names = async (request: Partial<NestStorage.StorageObjectGetFolderContent> = {}) =>
      (await content(request)).unwrap().items.map((item) => item.name);

    withDb('lists folders first, then by name, whichever way the name sorts', async () => {
      await createNamedLeaf('b.bin');
      await createFolder('b', root);
      await createNamedLeaf('a.bin');
      await createFolder('a', root);

      assert.deepEqual(await names(), ['a', 'b', 'a.bin', 'b.bin']);
      assert.deepEqual(await names({ sorters: [{ field: NAME, order: NestCommon.Sort.desc }] }), [
        'b',
        'a',
        'b.bin',
        'a.bin',
      ]);
    });

    // The column's ICU collation, not the server's libc: the musl of the alpine image here and in
    // CI would put every capital first and 'É' after 'z', and 'file10' before 'file2' on any libc.
    // Fails as well once a retyped column has lost its collation.
    withDb(
      'orders names by letter whatever their case or accent, and numbers by value',
      async () => {
        for (const name of [
          'zeta.bin',
          'B2.bin',
          'Été.bin',
          'a10.bin',
          'b.bin',
          'A1.bin',
          'a2.bin',
        ]) {
          await createNamedLeaf(name);
        }

        assert.deepEqual(await names(), [
          'A1.bin',
          'a2.bin',
          'a10.bin',
          'b.bin',
          'B2.bin',
          'Été.bin',
          'zeta.bin',
        ]);
      },
    );

    withDb('pages the content and counts all of it', async () => {
      for (const name of ['a', 'b', 'c', 'd', 'e']) {
        await createNamedLeaf(`${name}.bin`);
      }

      const page = (await content({ pagination: { page: 2, limit: 2 } })).unwrap();

      assert.deepEqual(
        page.items.map((item) => item.name),
        ['c.bin', 'd.bin'],
      );
      assert.equal(page.total, 5);
      assert.deepEqual(await names({ pagination: { page: 3, limit: 2 } }), ['e.bin']);
    });

    // Read off the page where the folders end, counted where the page cannot tell — under the same
    // scope and filters as the page itself.
    withDb('tells how many of the content are folders, on every page', async () => {
      for (const name of ['f1', 'f2', 'f3']) {
        await createFolder(name, root);
      }
      for (const name of ['x2', 'y2', 'z2']) {
        await createNamedLeaf(`${name}.bin`);
      }

      const folderTotal = async (request: Partial<NestStorage.StorageObjectGetFolderContent>) =>
        (await content(request)).unwrap().folderTotal;

      for (const page of [1, 2, 3]) {
        assert.equal(await folderTotal({ pagination: { page, limit: 2 } }), 3, `page ${page}`);
      }

      // `f2`, then the three files: a page of files alone, past the first.
      assert.equal(
        await folderTotal({ query: { types: [], search: '2' }, pagination: { page: 3, limit: 1 } }),
        1,
      );
    });

    // Rows created in one batch can share a timestamp; the id still puts them in one order, so an
    // offset page never repeats or skips one.
    withDb('breaks a tie on the id', async () => {
      const ids: string[] = [];

      for (const name of ['c', 'a', 'b']) {
        ids.push(await createNamedLeaf(`${name}.bin`));
      }

      await em
        .getConnection()
        .execute(
          `update "storage-objects" set created_at = '2026-01-01' where parent_id = ?`,
          [root],
          'run',
        );

      const byDate = await content({
        sorters: [{ field: CREATED_AT, order: NestCommon.Sort.asc }],
      });

      assert.deepEqual(
        byDate.unwrap().items.map((item) => item.id),
        [...ids].sort(),
      );
    });

    withDb('leaves out what is deleted', async () => {
      const gone = await createFolder('gone', root);
      await createNamedLeaf('inside.bin', gone);
      const goneLeaf = await createNamedLeaf('gone.bin');
      await createNamedLeaf('kept.bin');

      await repository.markDeletedWithDescendants(gone);
      await repository.markDeletedWithDescendants(goneLeaf);

      const page = (await content()).unwrap();

      assert.deepEqual(
        page.items.map((item) => item.name),
        ['kept.bin'],
      );
      assert.equal(page.total, 1);
    });

    withDb('narrows by type, by visibility and by a literal piece of the name', async () => {
      await placeImage('photo.png');
      await createNamedLeaf('a_b.bin');
      await createNamedLeaf('axb.bin');
      const shared = await createFolder('shared', root);
      await repository.updateAndCascadePublic(shared, { set: { isPublic: true } });

      assert.deepEqual(await names({ query: { types: [NestStorage.StorageObjectType.IMAGE] } }), [
        'photo.png',
      ]);
      assert.deepEqual(await names({ query: { types: [], isPublic: true } }), ['shared']);
      // `_` is a LIKE wildcard, matched here as itself; the case does not count.
      assert.deepEqual(await names({ query: { types: [], search: 'A_B' } }), ['a_b.bin']);
    });

    withDb('answers with the folder’s path and the folders above it', async () => {
      const a = await createFolder('a', root);
      const b = await createFolder('b', a);
      const c = await createFolder('c', b);

      const nested = (await content({ parentId: c })).unwrap();

      assert.equal(nested.folder.id, c);
      assert.equal(nested.folder.folderPath, '/a/b/c/');
      assert.deepEqual(nested.ancestors, [
        { id: root, name: '' },
        { id: a, name: 'a' },
        { id: b, name: 'b' },
      ]);

      const top = (await content()).unwrap();

      assert.equal(top.folder.folderPath, '/');
      assert.deepEqual(top.ancestors, []);
    });

    // A user's tree is closed: whatever the reason, the folder is not there for this user.
    withDb('refuses another user’s folder, a leaf and a deleted folder alike', async () => {
      const foreign = await createObject({ name: '', userId: OTHER_USER_ID });
      const leaf = await createLeaf(root);
      const deleted = await createFolder('deleted', root);
      await repository.markDeletedWithDescendants(deleted);

      for (const parentId of [foreign, leaf, deleted]) {
        const result = await content({ parentId });
        assert.ok(result.isLeft() && result.value instanceof NotFoundException, parentId);
      }
    });

    withDb('carries the media of every leaf', async () => {
      await placeFile('doc.bin');
      await placeImage('photo.png');
      await placeVideo('clip.mp4');

      const items = new Map((await content()).unwrap().items.map((item) => [item.name, item]));

      assert.equal(items.get('doc.bin')?.file?.size, 1);
      assert.equal(items.get('photo.png')?.image?.width, 2);
      assert.equal(items.get('photo.png')?.file?.size, 1);
      assert.equal(items.get('clip.mp4')?.video?.title, 'video');
    });

    // What the page populates is all the signing needs: the image's preview key, the plain file's,
    // the video's guid. An image without a preview is never signed by its original.
    withDb(
      'signs a preview for each READY image, video and PDF, and for nothing else',
      async () => {
        await createFolder('sub', root);
        await placeFile('doc.bin');
        const pdf = await placePdf('doc.pdf');
        (await fileRepository.setPreview(pdf.id, 'doc.preview.webp')).unwrap();
        const photo = await placeImage('photo.png');
        await placeImage('bare.png');
        await placeVideo('clip.mp4');
        (await imageRepository.setPreview(photo.id, 'photo.preview.webp')).unwrap();

        const items = new Map((await content()).unwrap().items.map((item) => [item.name, item]));
        const clip = items.get('clip.mp4');

        assert.equal(items.get('photo.png')?.previewUrl, 'https://storage.test/photo.preview.webp');
        assert.equal(items.get('bare.png')?.previewUrl, undefined);
        assert.equal(
          clip?.previewUrl,
          `https://stream.test/${clip?.video?.providerId}/thumbnail.jpg`,
        );
        assert.equal(items.get('doc.pdf')?.previewUrl, 'https://storage.test/doc.preview.webp');
        assert.equal(items.get('doc.bin')?.previewUrl, undefined);
        assert.equal(items.get('sub')?.previewUrl, undefined);
      },
    );

    describe('image preview bookkeeping', () => {
      const withoutPreview = async () =>
        (await read(() => imageRepository.getManyWithoutPreview(new Date(Date.now() + 60_000), 10)))
          .map((image) => image.id)
          .sort();

      withDb(
        'sweeps READY images with neither a preview nor a failure, with their file',
        async () => {
          const done = await placeImage('done.png');
          const failed = await placeImage('failed.png');
          const waiting = await placeImage('waiting.png');
          const pending = await imageRepository.saveAndPlaceOne({
            image: { width: 2, height: 3, alt: '', userId: USER_ID },
            file: { ...fileMeta('pending'), uploadStatus: NestStorage.FileUploadStatus.PENDING },
          });

          (await imageRepository.setPreview(done.id, 'done.preview.webp')).unwrap();
          (await imageRepository.markPreviewFailed(failed.id)).unwrap();

          assert.deepEqual(await withoutPreview(), [waiting.id]);
          assert.notEqual(pending.unwrap().id, waiting.id);

          const [swept] = await read(() =>
            imageRepository.getManyWithoutPreview(new Date(Date.now() + 60_000), 10),
          );
          assert.equal(swept.file.uploadStatus, NestStorage.FileUploadStatus.READY);
        },
      );

      withDb('leaves an image READY since the cutoff to the event handler', async () => {
        await placeImage('fresh.png');

        const swept = await read(() =>
          imageRepository.getManyWithoutPreview(new Date(Date.now() - 60_000), 10),
        );

        assert.deepEqual(swept, []);
      });

      // The sweep's cursor: a batch starts past the last id of the one before, whatever became of
      // those images — one that still has no preview does not come back in the same sweep.
      withDb('goes on past the id it is given, oldest first', async () => {
        const first = await placeImage('first.png');
        const second = await placeImage('second.png');
        const third = await placeImage('third.png');
        const readyBefore = new Date(Date.now() + 60_000);

        const batch = await read(() => imageRepository.getManyWithoutPreview(readyBefore, 2));
        assert.deepEqual(
          batch.map((image) => image.id),
          [first.id, second.id],
        );

        const rest = await read(() =>
          imageRepository.getManyWithoutPreview(readyBefore, 2, second.id),
        );
        assert.deepEqual(
          rest.map((image) => image.id),
          [third.id],
        );
      });

      withDb('keeps the first key recorded, and records nothing on a deleted image', async () => {
        const image = await placeImage('race.png');

        assert.equal((await imageRepository.setPreview(image.id, 'first')).unwrap(), true);
        assert.equal((await imageRepository.setPreview(image.id, 'second')).unwrap(), false);
        assert.equal((await imageRepository.markPreviewFailed(image.id)).unwrap(), false);

        const [stored] = await read(() => imageRepository.getMany({ ids: [image.id] }));
        assert.equal(stored.previewProviderId, 'first');
        assert.equal('previewFailedAt' in stored, false);

        (await imageRepository.deleteWithFile(image.id)).unwrap();
        assert.equal((await imageRepository.setPreview(image.id, 'late')).unwrap(), false);
      });

      // What the sweep counts against an image it came back from without a preview: the image
      // stays in the sweep until the count makes the cap, and the mark then takes it out.
      withDb('counts the sweeps an image failed, and gives up on it at the cap', async () => {
        const stuck = await placeImage('stuck.png');
        const other = await placeImage('other.png');

        assert.equal((await imageRepository.countPreviewAttempt(stuck.id, 3)).unwrap(), false);
        assert.equal((await imageRepository.countPreviewAttempt(stuck.id, 3)).unwrap(), false);
        assert.deepEqual(await withoutPreview(), [stuck.id, other.id].sort());

        assert.equal((await imageRepository.countPreviewAttempt(stuck.id, 3)).unwrap(), true);
        assert.deepEqual(await withoutPreview(), [other.id]);

        // Nothing is counted on an image given up on, nor on one that has its preview.
        assert.equal((await imageRepository.countPreviewAttempt(stuck.id, 3)).unwrap(), false);
        (await imageRepository.setPreview(other.id, 'other.preview.webp')).unwrap();
        assert.equal((await imageRepository.countPreviewAttempt(other.id, 1)).unwrap(), false);

        const [stored] = await read(() => imageRepository.getMany({ ids: [stuck.id] }));
        assert.equal('previewAttempts' in stored, false);
      });
    });

    describe('document preview bookkeeping', () => {
      const PDF = ['application/pdf'];
      const withoutPreview = async (readyBefore = new Date(Date.now() + 60_000)) =>
        (await read(() => fileRepository.getManyWithoutPreview(PDF, readyBefore, 10)))
          .map((file) => file.id)
          .sort();

      withDb(
        'sweeps READY PDFs with neither a preview nor a failure, and no other file',
        async () => {
          const done = await placePdf('done.pdf');
          const failed = await placePdf('failed.pdf');
          const waiting = await placePdf('waiting.pdf');
          await placePdf('pending.pdf', NestStorage.FileUploadStatus.PENDING);
          await placeFile('other.bin');
          await placeImage('photo.png');

          (await fileRepository.setPreview(done.id, 'done.preview.webp')).unwrap();
          (await fileRepository.markPreviewFailed(failed.id)).unwrap();

          assert.deepEqual(await withoutPreview(), [waiting.id]);
        },
      );

      withDb('leaves a PDF READY since the cutoff to the event handler', async () => {
        await placePdf('fresh.pdf');

        assert.deepEqual(await withoutPreview(new Date(Date.now() - 60_000)), []);
      });

      withDb('goes on past the id it is given, oldest first', async () => {
        const first = await placePdf('first.pdf');
        const second = await placePdf('second.pdf');
        const third = await placePdf('third.pdf');
        const readyBefore = new Date(Date.now() + 60_000);

        const batch = await read(() => fileRepository.getManyWithoutPreview(PDF, readyBefore, 2));
        assert.deepEqual(
          batch.map((file) => file.id),
          [first.id, second.id],
        );

        const rest = await read(() =>
          fileRepository.getManyWithoutPreview(PDF, readyBefore, 2, second.id),
        );
        assert.deepEqual(
          rest.map((file) => file.id),
          [third.id],
        );
      });

      withDb('keeps the first key recorded, and never shows the failure', async () => {
        const file = await placePdf('race.pdf');

        assert.equal((await fileRepository.setPreview(file.id, 'first')).unwrap(), true);
        assert.equal((await fileRepository.setPreview(file.id, 'second')).unwrap(), false);
        assert.equal((await fileRepository.markPreviewFailed(file.id)).unwrap(), false);

        const [stored] = await read(() => fileRepository.getMany({ ids: [file.id] }));
        assert.equal(stored.previewProviderId, 'first');
        assert.equal('previewFailedAt' in stored, false);
      });

      withDb('counts the sweeps a PDF failed, and gives up on it at the cap', async () => {
        const stuck = await placePdf('stuck.pdf');
        const other = await placePdf('other.pdf');
        const updatedAt = async () =>
          (await read(() => fileRepository.getMany({ ids: [stuck.id] })))[0].updatedAt;
        const before = await updatedAt();

        assert.equal((await fileRepository.countPreviewAttempt(stuck.id, 2)).unwrap(), false);
        assert.deepEqual(await withoutPreview(), [stuck.id, other.id].sort());
        // The sweep's grace is measured from `updated_at`: a count must not start it over.
        assert.deepEqual(await updatedAt(), before);

        assert.equal((await fileRepository.countPreviewAttempt(stuck.id, 2)).unwrap(), true);
        assert.deepEqual(await withoutPreview(), [other.id]);

        // Nothing is counted on a file given up on, nor on one that has its preview.
        assert.equal((await fileRepository.countPreviewAttempt(stuck.id, 2)).unwrap(), false);
        (await fileRepository.setPreview(other.id, 'other.preview.webp')).unwrap();
        assert.equal((await fileRepository.countPreviewAttempt(other.id, 1)).unwrap(), false);

        const [stored] = await read(() => fileRepository.getMany({ ids: [stuck.id] }));
        assert.equal('previewAttempts' in stored, false);
      });
    });

    // A file of a given size and status, placed like an upload.
    const placeSized = async (
      name: string,
      parent: string,
      size: number,
      uploadStatus = NestStorage.FileUploadStatus.READY,
    ) => {
      const file = await fileRepository.saveAndPlaceOne({
        file: { ...fileMeta(`file-${++placed}`), size, uploadStatus, userId: USER_ID },
        storageObject: placement(name, parent),
      });

      return file.unwrap();
    };

    withDb(
      "counts a folder's whole subtree: live subfolders, READY leaves and their bytes",
      async () => {
        const docs = await createFolder('docs', root);
        const sub = await createFolder('sub', docs);
        await placeSized('a.bin', docs, 2_000_000_000);
        await placeSized('pending.bin', docs, 7, NestStorage.FileUploadStatus.PENDING);
        await placeSized('failed.bin', sub, 7, NestStorage.FileUploadStatus.FAILED);
        await placeImage('i.png', sub);
        await placeVideo('v.mp4', sub);
        await placeSized('top.bin', root, 2_000_000_000);
        const gone = await createFolder('gone', root);
        await createFolder('inner', gone);
        await placeSized('gone.bin', gone, 5);
        (await repository.markDeletedWithDescendants(gone)).unwrap();

        const { folder, items } = (await content()).unwrap();
        const byName = new Map(items.map((item) => [item.name, item]));

        // Past `int32`: the sum arrives as a plain number, not as a string or a Long.
        assert.deepEqual(folder.folderStats, {
          fileCount: 4,
          folderCount: 2,
          totalSize: 4_000_000_002,
        });
        assert.deepEqual(byName.get('docs')?.folderStats, {
          fileCount: 3,
          folderCount: 1,
          totalSize: 2_000_000_002,
        });
        assert.equal(byName.get('top.bin')?.folderStats ?? undefined, undefined);
        assert.equal(byName.has('gone'), false);
      },
    );

    withDb('counts an empty folder as zeros, not as nothing', async () => {
      const empty = await createFolder('empty', root);

      const folder = await read(() =>
        repository.getOne<NestStorage.StorageObjectPopulated>(
          { id: empty },
          { populate: ['folderStats'] },
        ),
      );

      assert.deepEqual(folder.unwrap().folderStats, { fileCount: 0, folderCount: 0, totalSize: 0 });
    });

    // The folder with its path and stats, the walk up, the page with its to-one media joins, each
    // subfolder's stats and its COUNT: what an N+1 would break is that this stays four however much
    // the page holds.
    withDb('reads a page in the same number of statements however much it holds', async () => {
      const cost = () =>
        countStatements(() =>
          getFolderContent.execute({ parentId: root, userId: USER_ID, sorters: [] }),
        );

      let grown = 0;
      const grow = async (count: number) => {
        for (let n = 0; n < count; n++, grown++) {
          await createFolder(`f${grown}`, root);
          await placeImage(`i${grown}.png`);
          await placeVideo(`v${grown}.mp4`);
        }
      };

      await grow(1);
      const small = await cost();

      await grow(15);

      assert.equal(small, 4);
      assert.equal(await cost(), small);
    });
  });

  // Moves check for a cycle under the tree lock, but a row written outside the service can still
  // close one; no walk may run forever on it.
  withDb('ends every walk on a parent cycle instead of recursing forever', async () => {
    const a = await createFolder('a', root);
    const b = await createFolder('b', a);

    await em
      .getConnection()
      .execute('update "storage-objects" set parent_id = ? where id = ?', [b, a], 'run');

    const cyclePaths = await paths([a, b]);
    const cycleStats = await read(() =>
      repository.getOne<NestStorage.StorageObjectPopulated>(
        { id: a },
        { populate: ['folderStats'] },
      ),
    );
    const children = await read(() => repository.getAllChildrenIds(a));
    const ancestors = await read(() => repository.getAncestors(a));
    const cascaded = await repository.updateAndCascadePublic(a, { set: { isPublic: true } });
    const marked = await repository.markDeletedWithDescendants(a);

    assert.equal(typeof cyclePaths.get(a), 'string');
    // `b` below `a`, and `a` again below `b`: each id reached once.
    assert.equal(cycleStats.unwrap().folderStats?.folderCount, 2);
    assert.deepEqual([...children.unwrap()].sort(), [a, b].sort());
    assert.equal(ancestors.unwrap().length, MAX_FOLDER_DEPTH);
    assert.equal(cascaded.isRight(), true);
    assert.deepEqual(await publicIds(), [a, b].sort());
    assert.equal(marked.unwrap(), 2);
  });
});
