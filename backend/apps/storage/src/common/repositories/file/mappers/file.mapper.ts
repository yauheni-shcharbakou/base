import { PostgresMapper } from '@backend/persistence';
import { GrpcFile, GrpcFileQuery } from '@backend/grpc';
import { ObjectQuery } from '@mikro-orm/core';
import { FileEntity } from 'common/repositories/file/entities/file.entity';

export class FileMapper extends PostgresMapper<GrpcFile, FileEntity, GrpcFileQuery> {
  transformQuery({
    mimeTypes,
    users,
    uploadStatuses,
    createdAfter,
    ...rest
  }: Partial<GrpcFileQuery>): ObjectQuery<FileEntity> {
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
