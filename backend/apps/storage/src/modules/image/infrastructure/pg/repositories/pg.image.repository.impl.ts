import { PgMapper, PgRepositoryImpl } from '@backend/pg';
import { NestStorage } from '@backend/proto';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { ImageCreate, ImageRepository } from '@modules/image/domain/repositories/image.repository';
import { PgImageEntity } from '../entities/pg.image.entity';

export class PgImageRepositoryImpl
  extends PgRepositoryImpl<PgImageEntity, NestStorage.Image, NestStorage.ImageQuery, ImageCreate>
  implements ImageRepository
{
  constructor(
    @InjectRepository(PgImageEntity) protected readonly repository: EntityRepository<PgImageEntity>,
  ) {
    super(repository, new PgMapper());
  }
}
