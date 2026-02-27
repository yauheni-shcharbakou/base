import { GrpcStorageObject, GrpcStorageObjectQuery } from '@backend/grpc';
import { MongoRepositoryImpl } from '@backend/persistence';
import { InjectModel } from '@nestjs/mongoose';
import { StorageDatabaseEntity } from '@packages/common';
import { MongoStorageObjectEntity } from 'common/repositories/storage-object/entities/mongo.storage-object.entity';
import { MongoStorageObjectMapper } from 'common/repositories/storage-object/mappers/mongo.storage-object.mapper';
import { StorageObjectRepository } from 'common/repositories/storage-object/storage-object.repository';
import { Model } from 'mongoose';

export class StorageObjectRepositoryImpl
  extends MongoRepositoryImpl<MongoStorageObjectEntity, GrpcStorageObject, GrpcStorageObjectQuery>
  implements StorageObjectRepository
{
  constructor(
    @InjectModel(StorageDatabaseEntity.STORAGE_OBJECT)
    protected readonly model: Model<MongoStorageObjectEntity>,
  ) {
    super(model, new MongoStorageObjectMapper());
  }
}
