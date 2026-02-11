import { MongoMapper } from '@backend/persistence';
import { GrpcFile, GrpcFileQuery } from '@backend/grpc';
import { FileEntity } from 'common/entities/file.entity';
import _ from 'lodash';
import { QueryFilter } from 'mongoose';

export class FileMapper extends MongoMapper<GrpcFile, FileEntity, GrpcFileQuery> {
  transformQuery({
    mimeTypes,
    isPublic,
    users,
    ...rest
  }: Partial<GrpcFileQuery>): QueryFilter<FileEntity> {
    const result = super.transformQuery(rest);

    if (mimeTypes?.length) {
      result.mimeType = { $in: mimeTypes };
    }

    if (users?.length) {
      result.user = { $in: users };
    }

    if (_.isBoolean(isPublic)) {
      result.isPublic = isPublic;
    }

    return result;
  }
}
