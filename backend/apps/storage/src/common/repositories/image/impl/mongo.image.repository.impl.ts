import { GrpcImage, GrpcImageQuery } from '@backend/grpc';
import { MongoMapper, MongoRepositoryImpl } from '@backend/persistence';
import { InjectModel } from '@nestjs/mongoose';
import { StorageDatabaseEntity } from '@packages/common';
import { MongoImageEntity } from 'common/repositories/image/entities/mongo.image.entity';
import { ImageRepository } from 'common/repositories/image/image.repository';
import { Model } from 'mongoose';

export class MongoImageRepositoryImpl
  extends MongoRepositoryImpl<MongoImageEntity, GrpcImage, GrpcImageQuery>
  implements ImageRepository
{
  constructor(
    @InjectModel(StorageDatabaseEntity.IMAGE) protected readonly model: Model<MongoImageEntity>,
  ) {
    super(model, new MongoMapper());
  }
}
