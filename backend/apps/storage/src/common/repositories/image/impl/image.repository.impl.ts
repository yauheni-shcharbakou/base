import { GrpcImage, GrpcImageQuery } from '@backend/grpc';
import { PostgresRepositoryImpl } from '@backend/persistence';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { ImageEntity } from 'common/repositories/image/entities/image.entity';
import { ImageRepository } from 'common/repositories/image/image.repository';
import { ImageMapper } from 'common/repositories/image/mappers/image.mapper';

export class ImageRepositoryImpl
  extends PostgresRepositoryImpl<ImageEntity, GrpcImage, GrpcImageQuery>
  implements ImageRepository
{
  constructor(
    @InjectRepository(ImageEntity) protected readonly repository: EntityRepository<ImageEntity>,
  ) {
    super(repository, new ImageMapper());
  }
}
