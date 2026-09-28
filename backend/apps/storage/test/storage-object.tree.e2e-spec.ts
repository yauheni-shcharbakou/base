import './pg.e2e';
import { NestStorage } from '@backend/proto';
import { PgFileEntity } from '@common/infrastructure/pg/entities/pg.file.entity';
import { PgStorageObjectEntity } from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { StorageObjectValidationService } from '@modules/storage-object/application/services/storage-object.validation.service';
import { StorageObjectCreateOneUseCase } from '@modules/storage-object/application/use-cases/storage-object.create-one.use-case';
import { StorageObjectDeleteOneUseCase } from '@modules/storage-object/application/use-cases/storage-object.delete-one.use-case';
import { StorageObjectUpdateOneUseCase } from '@modules/storage-object/application/use-cases/storage-object.update-one.use-case';
import { PgStorageObjectRepositoryImpl } from '@modules/storage-object/infrastructure/pg/repositories/pg.storage-object.repository.impl';
import { EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
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

  // Every statement the ORM sends; a spec resets it to measure what one call costs.
  let statements: string[] = [];

  // In a hook, not in an async suite body: `node:test` reports an error thrown there but still
  // exits 0, which would turn a broken migration into a green run.
  before(async () => {
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
  });

  after(() => orm?.close());

  // Skipped rather than failed without a server, like the Redis e2e suites. The timeout turns a
  // recursion that never ends into a failure instead of a hung run.
  const withDb = (name: string, fn: () => Promise<void>) =>
    it(name, { timeout: 30_000 }, (t) =>
      orm ? fn() : t.skip('no Postgres — start one with `pnpm docker:local`'),
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
              { populate: [...POPULATE] },
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

    withDb('refuses a name the target folder already has, on a move and on a rename', async () => {
      const docs = await createFolder('docs', root);
      const archive = await createFolder('archive', root);
      await createFolder('docs', archive);
      await createFile('b.txt', docs);
      const file = await createFile('a.txt', docs);

      const moved = await updateOne.execute(byId(docs), { set: { parent: archive } });
      const renamed = await updateOne.execute(byId(file), { set: { name: 'b.txt' } });

      assert.ok(moved.isLeft() && moved.value instanceof ConflictException);
      assert.ok(renamed.isLeft() && renamed.value instanceof ConflictException);
      assert.equal((await paths([docs])).get(docs), '/docs/', 'the refused move wrote nothing');
    });

    withDb('frees the name of a deleted object at once', async () => {
      const docs = await createFolder('docs', root);
      const drafts = await createFolder('drafts', root);
      await repository.markDeletedWithDescendants(docs);

      const renamed = await updateOne.execute(byId(drafts), { set: { name: 'docs' } });

      assert.equal(renamed.unwrap().name, 'docs');
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

  // Moves check for a cycle under the tree lock, but a row written outside the service can still
  // close one; no walk may run forever on it.
  withDb('ends every walk on a parent cycle instead of recursing forever', async () => {
    const a = await createFolder('a', root);
    const b = await createFolder('b', a);

    await em
      .getConnection()
      .execute('update "storage-objects" set parent_id = ? where id = ?', [b, a], 'run');

    const cyclePaths = await paths([a, b]);
    const children = await read(() => repository.getAllChildrenIds(a));
    const cascaded = await repository.updateAndCascadePublic(a, { set: { isPublic: true } });
    const marked = await repository.markDeletedWithDescendants(a);

    assert.equal(typeof cyclePaths.get(a), 'string');
    assert.deepEqual([...children.unwrap()].sort(), [a, b].sort());
    assert.equal(cascaded.isRight(), true);
    assert.deepEqual(await publicIds(), [a, b].sort());
    assert.equal(marked.unwrap(), 2);
  });
});
