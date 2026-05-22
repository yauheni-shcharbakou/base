import { PgRepositoryImpl } from '@backend/pg';
import { NestStorage } from '@backend/proto';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { VideoCreate, VideoRepository } from '@modules/video/domain/repositories/video.repository';
import { PgVideoEntity } from '../entities/pg.video.entity';
import { PgVideoMapper } from '../mappers/pg.video.mapper';

export class PgVideoRepositoryImpl
  extends PgRepositoryImpl<PgVideoEntity, NestStorage.Video, NestStorage.VideoQuery, VideoCreate>
  implements VideoRepository
{
  constructor(
    @InjectRepository(PgVideoEntity) protected readonly repository: EntityRepository<PgVideoEntity>,
  ) {
    super(repository, new PgVideoMapper());
  }
}
