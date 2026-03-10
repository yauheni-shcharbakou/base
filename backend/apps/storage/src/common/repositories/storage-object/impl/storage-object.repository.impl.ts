import { GrpcStorageObject, GrpcStorageObjectQuery } from '@backend/grpc';
import { PostgresRepositoryImpl } from '@backend/persistence';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { StorageObjectEntity } from 'common/repositories/storage-object/entities/storage-object.entity';
import { StorageObjectMapper } from 'common/repositories/storage-object/mappers/storage-object.mapper';
import {
  StorageObjectCreate,
  StorageObjectRepository,
  StorageObjectUpdate,
} from 'common/repositories/storage-object/storage-object.repository';

export class StorageObjectRepositoryImpl
  extends PostgresRepositoryImpl<
    StorageObjectEntity,
    GrpcStorageObject,
    GrpcStorageObjectQuery,
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
}
