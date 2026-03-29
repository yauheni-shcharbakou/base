import { PostgresMapper } from '@backend/persistence';
import { GrpcVideo, GrpcVideoQuery } from '@backend/grpc';
import { ObjectQuery } from '@mikro-orm/core';
import { VideoEntity } from 'common/repositories/video/entities/video.entity';

export class VideoMapper extends PostgresMapper<VideoEntity, GrpcVideo, GrpcVideoQuery> {
  transformQuery({ providerIds, ...rest }: Partial<GrpcVideoQuery>): ObjectQuery<VideoEntity> {
    const result = super.transformQuery(rest);

    if (providerIds?.length) {
      result.providerId = { $in: providerIds };
    }

    return result;
  }
}
