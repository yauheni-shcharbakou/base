import { GrpcIdField, GrpcStorageObject } from '@backend/grpc';
import { PostgresRepositoryImpl } from '@backend/persistence';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { StorageObjectEntity } from 'common/repositories/storage-object/entities/storage-object.entity';
import { StorageObjectMapper } from 'common/repositories/storage-object/mappers/storage-object.mapper';
import {
  StorageObjectCreate,
  StorageObjectQuery,
  StorageObjectRepository,
  StorageObjectUpdate,
} from 'common/repositories/storage-object/storage-object.repository';
import _ from 'lodash';

export class StorageObjectRepositoryImpl
  extends PostgresRepositoryImpl<
    StorageObjectEntity,
    GrpcStorageObject,
    StorageObjectQuery,
    StorageObjectCreate,
    StorageObjectUpdate
  >
  implements StorageObjectRepository
{
  constructor(
    @InjectRepository(StorageObjectEntity)
    protected readonly repository: EntityRepository<StorageObjectEntity>,
  ) {
    super(repository, new StorageObjectMapper());
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

      const results = await this.em.execute<GrpcIdField[]>(sql, [parent]);
      return new Set(_.map(results, (entity) => entity.id));
    } catch (error) {
      return new Set();
    }
  }
}
