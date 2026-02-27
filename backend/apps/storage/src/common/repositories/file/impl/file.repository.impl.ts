import { GrpcFile, GrpcFileQuery, GrpcFileUploadStatus } from '@backend/grpc';
import { PostgresRepositoryImpl } from '@backend/persistence';
import { EntityRepository } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Either } from '@sweet-monads/either';
import { FileEntity } from 'common/repositories/file/entities/file.entity';
import { FileCreate, FileRepository } from 'common/repositories/file/file.repository';
import { FileMapper } from 'common/repositories/file/mappers/file.mapper';
import { extname } from 'node:path';

export class FileRepositoryImpl
  extends PostgresRepositoryImpl<FileEntity, GrpcFile, GrpcFileQuery>
  implements FileRepository
{
  constructor(
    @InjectRepository(FileEntity) protected readonly repository: EntityRepository<FileEntity>,
  ) {
    super(repository, new FileMapper());
  }

  async saveOne(createData: FileCreate): Promise<Either<Error, GrpcFile>> {
    const extension = extname(createData.originalName).replace(/^./g, '');
    return super.saveOne({ ...createData, extension, uploadStatus: GrpcFileUploadStatus.PENDING });
  }
}
