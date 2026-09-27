import { PgRepositoryImpl } from '@backend/pg';
import { NestCommon } from '@backend/proto';
import { PgStorageObjectEntity } from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { Logger, NotFoundException } from '@nestjs/common';
import { LockMode, QueryResult } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { StorageObject } from '@modules/storage-object/domain/entities/storage-object.interface';
import {
  StorageObjectCreate,
  StorageObjectQuery,
  StorageObjectRepository,
  StorageObjectUpdate,
} from '@modules/storage-object/domain/repositories/storage-object.repository';
import { StorageDatabaseEntity } from '@packages/common';
import { Either, left, right } from '@sweet-monads/either';
import _ from 'lodash';
import { PgStorageObjectMapper } from '../mappers/pg.storage-object.mapper';

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
  private readonly logger = new Logger(PgStorageObjectRepositoryImpl.name);

  constructor(
    @InjectRepository(PgStorageObjectEntity)
    protected readonly repository: EntityRepository<PgStorageObjectEntity>,
  ) {
    super(repository, new PgStorageObjectMapper());
  }

  async getAllChildrenIds(parent: string): Promise<Set<string>> {
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
      return new Set(_.map(results, (entity) => entity.id));
    } catch (error) {
      this.logger.error(`Failed to resolve children ids for parent ${parent}`, error);
      return new Set();
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
        return left(new NotFoundException(`${this.repository.getEntityName()} not found`));
      }

      return right(updated);
    } catch (error) {
      this.logger.error(`Failed to update storage object ${id}`, error);
      return left(error);
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

  // One statement over the whole subtree, so a folder and its content cannot end up half-deleted.
  // Already-deleted rows are skipped: they are hidden anyway, and the cleanup cron owns them.
  // Every walk here is `UNION`, not `UNION ALL`: the CTE carries only ids, so deduplication also
  // ends the recursion on a `parent_id` cycle instead of running forever.
  async markDeletedWithDescendants(id: string): Promise<Either<Error, number>> {
    const table = StorageDatabaseEntity.STORAGE_OBJECT;

    try {
      const sql = `
        WITH RECURSIVE subtree AS (
            SELECT id FROM "${table}" WHERE id = ?

            UNION

            SELECT e.id
            FROM "${table}" e
            INNER JOIN subtree s ON e.parent_id = s.id
        )
        UPDATE "${table}" SET is_deleted = true, updated_at = now()
        WHERE id IN (SELECT id FROM subtree) AND is_deleted = false;
      `;

      const result = await this.em.execute<QueryResult>(sql, [id], 'run');
      return right(result.affectedRows);
    } catch (error) {
      this.logger.error(`Failed to mark the subtree of ${id} deleted`, error);
      return left(error);
    }
  }

  // Leaves first, never a parent before its children: `parent_id` is `on delete set null`, so a
  // folder deleted ahead of a subfolder would turn that subfolder into a second root and trip the
  // root-folder unique index. Each call removes the current bottom level; a folder still holding a
  // file the file cleanup has not reached yet simply waits for a later run.
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
}
