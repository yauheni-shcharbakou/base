import { PgRepositoryImpl } from '@backend/pg';
import { NestCommon } from '@backend/proto';
import { PgStorageObjectEntity } from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { StorageObject } from '@modules/storage-object/domain/entities/storage-object.interface';
import {
  StorageObjectCreate,
  StorageObjectQuery,
  StorageObjectRepository,
  StorageObjectUpdate,
} from '@modules/storage-object/domain/repositories/storage-object.repository';
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
  constructor(
    @InjectRepository(PgStorageObjectEntity)
    protected readonly repository: EntityRepository<PgStorageObjectEntity>,
  ) {
    super(repository, new PgStorageObjectMapper());
  }

  async getAllChildrenIds(parent: string): Promise<Set<string>> {
    try {
      const sql = `
        WITH RECURSIVE descendants AS (
            SELECT id, parent_id, is_folder
            FROM "storage-objects"
            WHERE parent_id = ?

            UNION ALL

            SELECT e.id, e.parent_id, e.is_folder
            FROM "storage-objects" e
            INNER JOIN descendants d ON e.parent_id = d.id
        )
        SELECT id FROM descendants WHERE is_folder = true;
      `;

      const results = await this.em.execute<NestCommon.IdField[]>(sql, [parent]);
      return new Set(_.map(results, (entity) => entity.id));
    } catch (error) {
      return new Set();
    }
  }
}
