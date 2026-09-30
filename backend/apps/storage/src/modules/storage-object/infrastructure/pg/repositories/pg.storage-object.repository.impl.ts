import { PgRepositoryImpl } from '@backend/pg';
import { NestCommon, NestStorage } from '@backend/proto';
import {
  MAX_FOLDER_DEPTH,
  PgStorageObjectEntity,
} from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { Logger } from '@nestjs/common';
import { LockMode, QueryResult } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { StorageObject } from '@modules/storage-object/domain/entities/storage-object.interface';
import {
  StorageObjectCreate,
  StorageObjectLeafType,
  StorageObjectMedia,
  StorageObjectMediaQuery,
  StorageObjectQuery,
  StorageObjectRepository,
  StorageObjectUpdate,
} from '@modules/storage-object/domain/repositories/storage-object.repository';
import { StorageDatabaseEntity } from '@packages/common';
import { Either, left, right } from '@sweet-monads/either';
import _ from 'lodash';
import { PgStorageObjectMapper } from '../mappers/pg.storage-object.mapper';

// The lock's first key; the owner's id is the second. A per-owner key is enough to stop two
// opposite moves from closing a cycle because no `parent` link crosses two users: placement
// refuses another user's folder, and `storage-objects_parent_owner_foreign` refuses such a row
// whoever writes it. Two owners whose ids hash alike only queue behind each other.
const TREE_LOCK = `${StorageDatabaseEntity.STORAGE_OBJECT}.tree`;

// The storage-object column that references each kind of media.
const MEDIA_COLUMN: Record<StorageObjectLeafType, string> = {
  [NestStorage.StorageObjectType.FILE]: 'file_id',
  [NestStorage.StorageObjectType.IMAGE]: 'image_id',
  [NestStorage.StorageObjectType.VIDEO]: 'video_id',
};

// Carries a `left` out of `em.transactional`, which rolls back only when its callback throws.
class TreeWriteRejected extends Error {
  constructor(readonly reason: Error) {
    super(reason.message);
  }
}

export class PgStorageObjectRepositoryImpl
  extends PgRepositoryImpl<
    PgStorageObjectEntity,
    StorageObject,
    StorageObjectQuery,
    StorageObjectCreate,
    StorageObjectUpdate
  >
  implements StorageObjectRepository
{
  protected readonly resourceName = 'Storage object';
  private readonly logger = new Logger(PgStorageObjectRepositoryImpl.name);

  constructor(
    @InjectRepository(PgStorageObjectEntity)
    protected readonly repository: EntityRepository<PgStorageObjectEntity>,
  ) {
    super(repository, new PgStorageObjectMapper());
  }

  async getAllChildrenIds(parent: string): Promise<Either<Error, Set<string>>> {
    const table = StorageDatabaseEntity.STORAGE_OBJECT;

    try {
      const sql = `
        WITH RECURSIVE descendants AS (
            SELECT id, parent_id, is_folder
            FROM "${table}"
            WHERE parent_id = ?

            UNION

            SELECT e.id, e.parent_id, e.is_folder
            FROM "${table}" e
            INNER JOIN descendants d ON e.parent_id = d.id
        )
        SELECT id FROM descendants WHERE is_folder = true;
      `;

      const results = await this.em.execute<NestCommon.IdField[]>(sql, [parent]);
      return right(new Set(_.map(results, (entity) => entity.id)));
    } catch (error) {
      this.logger.error(`Failed to resolve children ids for parent ${parent}`, error);
      return left(error);
    }
  }

  async withTreeLock<T>(
    userId: string,
    work: () => Promise<Either<Error, T>>,
  ): Promise<Either<Error, T>> {
    try {
      // Repository calls inside `work` join this transaction through MikroORM's transaction
      // context. `clear` gives it an empty identity map, so no check reads an entity cached before
      // the lock was taken.
      return await this.em.transactional(
        async (em) => {
          // Transaction-scoped: the commit or the rollback releases it, so it never outlives `work`.
          // A waiter holds its pool connection while it waits.
          await em.execute('select pg_advisory_xact_lock(hashtext(?), hashtext(?))', [
            TREE_LOCK,
            userId,
          ]);

          const result = await work();

          if (result.isLeft()) {
            throw new TreeWriteRejected(result.value);
          }

          return result;
        },
        { clear: true },
      );
    } catch (error) {
      if (error instanceof TreeWriteRejected) {
        return left(error.reason);
      }

      this.logger.error('Failed to run a write under the tree lock', error);
      return left(error);
    }
  }

  async updateAndCascadePublic(
    id: string,
    update: StorageObjectUpdate,
  ): Promise<Either<Error, StorageObject>> {
    try {
      const updated = await this.em.transactional(async (em) => {
        // Locked and re-read, so two updates of the same folder decide whether `isPublic` changed
        // one after the other, not both against the value from before either of them.
        const entity = await em.findOne(
          PgStorageObjectEntity,
          { id },
          { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
        );

        if (!entity) {
          return undefined;
        }

        const wasPublic = entity.isPublic;

        this.convertUpdate(entity, update);
        await em.flush();

        if (entity.isFolder && entity.isPublic !== wasPublic) {
          await this.setPublicOnDescendants(em, id, entity.isPublic);
        }

        return this.mapper.stringify(entity);
      });

      if (!updated) {
        return left(this.notFound());
      }

      return right(updated);
    } catch (error) {
      // A rename onto a taken name, written past the service's check, is a conflict like the
      // check's own refusal — not a server error.
      const repositoryError = this.toRepositoryError(error);

      if (repositoryError === error) {
        this.logger.error(`Failed to update storage object ${id}`, error);
      }

      return left(repositoryError);
    }
  }

  // Descendants only — the folder itself was just written through the ORM. Runs on the caller's
  // transactional manager, so it commits or rolls back together with that write.
  private async setPublicOnDescendants(
    em: EntityManager,
    id: string,
    isPublic: boolean,
  ): Promise<void> {
    const table = StorageDatabaseEntity.STORAGE_OBJECT;

    const sql = `
      WITH RECURSIVE subtree AS (
          SELECT id FROM "${table}" WHERE parent_id = ?

          UNION

          SELECT e.id
          FROM "${table}" e
          INNER JOIN subtree s ON e.parent_id = s.id
      )
      UPDATE "${table}" SET is_public = ?, updated_at = now()
      WHERE id IN (SELECT id FROM subtree) AND is_public <> ?;
    `;

    await em.execute<QueryResult>(sql, [id, isPublic, isPublic], 'run');
  }

  // Up by primary key, one lookup per level, from the object's parent to the root. `UNION ALL` never
  // deduplicates the rows, whose depth differs anyway: the depth bound is what ends a walk over a
  // `parent_id` cycle, as in the `folderPath` formula.
  async getAncestors(id: string): Promise<Either<Error, NestStorage.StorageObjectAncestor[]>> {
    const table = StorageDatabaseEntity.STORAGE_OBJECT;

    try {
      const sql = `
        WITH RECURSIVE up (id, name, parent_id, depth) AS (
            SELECT p.id, p.name, p.parent_id, 1
            FROM "${table}" o
            INNER JOIN "${table}" p ON p.id = o.parent_id
            WHERE o.id = ?

            UNION ALL

            SELECT p.id, p.name, p.parent_id, up.depth + 1
            FROM up
            INNER JOIN "${table}" p ON p.id = up.parent_id
            WHERE up.depth < ${MAX_FOLDER_DEPTH}
        )
        SELECT id, name FROM up ORDER BY depth DESC;
      `;

      return right(await this.em.execute<NestStorage.StorageObjectAncestor[]>(sql, [id]));
    } catch (error) {
      this.logger.error(`Failed to resolve the ancestors of ${id}`, error);
      return left(error);
    }
  }

  // One statement over the whole subtree, so a folder and its content cannot end up half-deleted.
  // Already-deleted rows are skipped: they are hidden anyway, and the cleanup cron owns them.
  // Every walk down here is `UNION`, not `UNION ALL`: the CTE carries only ids, so deduplication
  // also ends the recursion on a `parent_id` cycle instead of running forever.
  async markManyDeletedWithDescendants(ids: string[]): Promise<Either<Error, number>> {
    // `IN ()` is a syntax error, and nothing is the right answer anyway.
    if (!ids.length) {
      return right(0);
    }

    const table = StorageDatabaseEntity.STORAGE_OBJECT;

    try {
      const sql = `
        WITH RECURSIVE subtree AS (
            SELECT id FROM "${table}" WHERE id IN (${ids.map(() => '?').join(', ')})

            UNION

            SELECT e.id
            FROM "${table}" e
            INNER JOIN subtree s ON e.parent_id = s.id
        )
        UPDATE "${table}" SET is_deleted = true, updated_at = now()
        WHERE id IN (SELECT id FROM subtree) AND is_deleted = false;
      `;

      const result = await this.em.execute<QueryResult>(sql, ids, 'run');
      return right(result.affectedRows);
    } catch (error) {
      this.logger.error(`Failed to mark the subtrees of ${ids.join(', ')} deleted`, error);
      return left(error);
    }
  }

  markDeletedWithDescendants(id: string): Promise<Either<Error, number>> {
    return this.markManyDeletedWithDescendants([id]);
  }

  async getLiveOwnerIds(): Promise<string[]> {
    const rows = await this.em.execute<{ user_id: string }[]>(
      `SELECT DISTINCT user_id FROM "${StorageDatabaseEntity.STORAGE_OBJECT}" WHERE is_deleted = false`,
    );

    return rows.map((row) => row.user_id);
  }

  // Leaves first, never a parent before its children: `storage-objects_parent_owner_foreign` is
  // `on delete no action`, so a folder deleted ahead of a subfolder fails the statement. Each call
  // removes the current bottom level; a folder still holding a file the file cleanup has not
  // reached yet simply waits for a later run.
  async deleteEmptyDeletedFolders(): Promise<Either<Error, number>> {
    const table = StorageDatabaseEntity.STORAGE_OBJECT;

    try {
      const sql = `
        DELETE FROM "${table}" f
        WHERE f.is_deleted = true
          AND f.is_folder = true
          AND NOT EXISTS (SELECT 1 FROM "${table}" c WHERE c.parent_id = f.id);
      `;

      const result = await this.em.execute<QueryResult>(sql, [], 'run');
      return right(result.affectedRows);
    } catch (error) {
      this.logger.error('Failed to delete empty deleted folders', error);
      return left(error);
    }
  }

  // An image or a video is placed together with its backing file, so either reference counts.
  async getMediaToPlace({
    type,
    id,
    userId,
  }: StorageObjectMediaQuery): Promise<Either<Error, StorageObjectMedia | undefined>> {
    const objects = StorageDatabaseEntity.STORAGE_OBJECT;
    const files = StorageDatabaseEntity.FILE;
    const images = StorageDatabaseEntity.IMAGE;
    const videos = StorageDatabaseEntity.VIDEO;

    const sql =
      type === NestStorage.StorageObjectType.FILE
        ? `
          SELECT m.id AS "fileId",
            EXISTS (SELECT 1 FROM "${objects}" s WHERE s.file_id = m.id) AS "isPlaced",
            EXISTS (SELECT 1 FROM "${images}" i WHERE i.file_id = m.id)
              OR EXISTS (SELECT 1 FROM "${videos}" v WHERE v.file_id = m.id) AS "isBacking",
            m.upload_status AS "uploadStatus"
          FROM "${files}" m
          WHERE m.id = ? AND m.user_id = ?;
        `
        : `
          SELECT m.file_id AS "fileId",
            EXISTS (
              SELECT 1 FROM "${objects}" s WHERE s.${MEDIA_COLUMN[type]} = m.id OR s.file_id = m.file_id
            ) AS "isPlaced",
            false AS "isBacking",
            f.upload_status AS "uploadStatus"
          FROM "${type === NestStorage.StorageObjectType.IMAGE ? images : videos}" m
          INNER JOIN "${files}" f ON f.id = m.file_id
          WHERE m.id = ? AND m.user_id = ?;
        `;

    try {
      const [media] = await this.em.execute<StorageObjectMedia[]>(sql, [id, userId]);
      return right(media);
    } catch (error) {
      this.logger.error(`Failed to read the ${type} ${id} to place`, error);
      return left(error);
    }
  }
}
