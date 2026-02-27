import { MongoMapper } from '@backend/persistence';
import { GrpcFile, GrpcFileQuery } from '@backend/grpc';
import { MongoFileEntity } from 'common/repositories/file/entities/mongo.file.entity';
import { QueryFilter } from 'mongoose';

export class MongoFileMapper extends MongoMapper<GrpcFile, MongoFileEntity, GrpcFileQuery> {
  transformQuery({
    mimeTypes,
    users,
    uploadStatuses,
    createdAfter,
    ...rest
  }: Partial<GrpcFileQuery>): QueryFilter<MongoFileEntity> {
    const result = super.transformQuery(rest);

    if (mimeTypes?.length) {
      result.mimeType = { $in: mimeTypes };
    }

    if (users?.length) {
      result.user = { $in: users };
    }

    if (uploadStatuses?.length) {
      result.uploadStatus = { $in: uploadStatuses };
    }

    if (createdAfter) {
      result.createdAt = { $gte: createdAfter };
    }

    return result;
  }
}
