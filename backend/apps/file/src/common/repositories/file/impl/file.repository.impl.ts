import {
  GrpcFile,
  GrpcFileCreate,
  GrpcFileQuery,
  GrpcFileType,
  GrpcFileUpdate,
} from '@backend/grpc';
import { CreateOf, MongoRepositoryImpl } from '@backend/persistence';
import { InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Either } from '@sweet-monads/either';
import { FileEntity } from 'common/entities/file.entity';
import { FileRepository } from 'common/repositories/file/file.repository';
import { FileMapper } from 'common/repositories/file/mappers/file.mapper';
import { Model } from 'mongoose';
import { extname } from 'node:path';

export class FileRepositoryImpl
  extends MongoRepositoryImpl<
    FileEntity,
    GrpcFile,
    GrpcFileQuery,
    CreateOf<GrpcFile>,
    GrpcFileUpdate
  >
  implements FileRepository
{
  constructor(@InjectModel(FileEntity.name) protected readonly model: Model<FileEntity>) {
    super(model, new FileMapper());
  }

  private readonly typeByMimeType: Map<string, GrpcFileType> = new Map([
    ['image/bmp', GrpcFileType.IMAGE],
    ['image/gif', GrpcFileType.IMAGE],
    ['image/png', GrpcFileType.IMAGE],
    ['image/apng', GrpcFileType.IMAGE],
    ['image/jpeg', GrpcFileType.IMAGE],
    ['image/svg+xml', GrpcFileType.IMAGE],
    ['image/tiff', GrpcFileType.IMAGE],
    ['image/webp', GrpcFileType.IMAGE],
    ['image/vnd.microsoft.icon', GrpcFileType.IMAGE],
    ['application/msword', GrpcFileType.DOCUMENT],
    [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      GrpcFileType.DOCUMENT,
    ],
    ['application/vnd.oasis.opendocument.presentation', GrpcFileType.DOCUMENT],
    ['application/vnd.oasis.opendocument.spreadsheet', GrpcFileType.DOCUMENT],
    ['application/vnd.oasis.opendocument.text', GrpcFileType.DOCUMENT],
    ['application/vnd.ms-powerpoint', GrpcFileType.DOCUMENT],
    [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      GrpcFileType.DOCUMENT,
    ],
    ['application/vnd.visio', GrpcFileType.DOCUMENT],
    ['application/vnd.ms-excel', GrpcFileType.DOCUMENT],
    ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', GrpcFileType.DOCUMENT],
  ]);

  async saveOne(
    createData: GrpcFileCreate,
  ): Promise<Either<InternalServerErrorException, GrpcFile>> {
    const extension = extname(createData.originalName).replace(/^./g, '');
    const type = this.typeByMimeType.get(createData.mimeType) ?? GrpcFileType.OTHER;
    return super.saveOne({ ...createData, extension, type });
  }
}
