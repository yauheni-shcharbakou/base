import { GrpcVideo, GrpcVideoQuery } from '@backend/grpc';
import { PostgresRepositoryImpl } from '@backend/persistence';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { VideoEntity } from 'common/repositories/video/entities/video.entity';
import { VideoMapper } from 'common/repositories/video/mappers/video.mapper';
import { VideoRepository } from 'common/repositories/video/video.repository';

export class VideoRepositoryImpl
  extends PostgresRepositoryImpl<VideoEntity, GrpcVideo, GrpcVideoQuery>
  implements VideoRepository
{
  constructor(
    @InjectRepository(VideoEntity) protected readonly repository: EntityRepository<VideoEntity>,
  ) {
    super(repository, new VideoMapper());
  }
}
