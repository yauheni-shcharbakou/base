import { MongoRepositoryImpl } from '@backend/persistence';
import { InjectModel } from '@nestjs/mongoose';
import { GrpcFile, GrpcFileCreate, GrpcFileQuery, GrpcFileUpdate } from '@backend/grpc';
import { FileEntity } from 'common/entities/file.entity';
import { FileRepository } from 'common/repositories/file/file.repository';
import { FileMapper } from 'common/repositories/file/mappers/file.mapper';
import { Model } from 'mongoose';

export class FileRepositoryImpl
  extends MongoRepositoryImpl<FileEntity, GrpcFile, GrpcFileQuery, GrpcFileCreate, GrpcFileUpdate>
  implements FileRepository
{
  constructor(@InjectModel(FileEntity.name) protected readonly model: Model<FileEntity>) {
    super(model, new FileMapper());
  }
}
