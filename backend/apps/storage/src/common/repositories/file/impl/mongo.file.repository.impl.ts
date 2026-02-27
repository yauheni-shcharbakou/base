import { GrpcFile, GrpcFileQuery, GrpcFileUploadStatus } from '@backend/grpc';
import { MongoRepositoryImpl } from '@backend/persistence';
import { InjectModel } from '@nestjs/mongoose';
import { StorageDatabaseEntity } from '@packages/common';
import { Either } from '@sweet-monads/either';
import { MongoFileEntity } from 'common/repositories/file/entities/mongo.file.entity';
import { FileCreate, FileRepository } from 'common/repositories/file/file.repository';
import { MongoFileMapper } from 'common/repositories/file/mappers/mongo.file.mapper';
import { Model } from 'mongoose';
import { extname } from 'node:path';

export class MongoFileRepositoryImpl
  extends MongoRepositoryImpl<MongoFileEntity, GrpcFile, GrpcFileQuery>
  implements FileRepository
{
  constructor(
    @InjectModel(StorageDatabaseEntity.FILE) protected readonly model: Model<MongoFileEntity>,
  ) {
    super(model, new MongoFileMapper());
  }

  async saveOne(createData: FileCreate): Promise<Either<Error, GrpcFile>> {
    const extension = extname(createData.originalName).replace(/^./g, '');
    return super.saveOne({ ...createData, extension, uploadStatus: GrpcFileUploadStatus.PENDING });
  }
}
