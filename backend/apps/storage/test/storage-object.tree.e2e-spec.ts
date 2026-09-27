import './pg.e2e';
import { NestStorage } from '@backend/proto';
import { PgStorageObjectEntity } from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { PgStorageObjectRepositoryImpl } from '@modules/storage-object/infrastructure/pg/repositories/pg.storage-object.repository.impl';
import { EntityManager, MikroORM } from '@mikro-orm/postgresql';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { startOrm } from './pg.e2e';

const USER_ID = '01JQ0000000000000000000001';

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
  }: {
    name: string;
    parent?: string;
    isFolder?: boolean;
  }): Promise<string> => {
    const object = em.create(PgStorageObjectEntity, {
      userId: USER_ID,
      name,
      type: isFolder ? NestStorage.StorageObjectType.FOLDER : NestStorage.StorageObjectType.FILE,
      isFolder,
      isPublic: false,
      ...(parent ? { parent } : {}),
    } as never);

    await em.persist(object).flush();
    return object.id;
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

  // Two concurrent opposite moves can close a `parent_id` cycle; no walk may run forever on one.
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
    assert.deepEqual([...children].sort(), [a, b].sort());
    assert.equal(cascaded.isRight(), true);
    assert.deepEqual(await publicIds(), [a, b].sort());
    assert.equal(marked.unwrap(), 2);
  });
});
