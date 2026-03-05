import { PostgresMapper } from '@backend/persistence';
import { GrpcFile, GrpcFileQuery, GrpcImage, GrpcImageQuery } from '@backend/grpc';
import { ObjectQuery, ref, wrap } from '@mikro-orm/core';
import { FileEntity } from 'common/repositories/file/entities/file.entity';
import { ImageEntity } from 'common/repositories/image/entities/image.entity';
import _ from 'lodash';

// TODO: maybe makes sense to add permanent populate (it's auto for entity creation in MikroORM)

export class ImageMapper extends PostgresMapper<GrpcImage, ImageEntity, GrpcImageQuery> {
  stringify(entity: ImageEntity): GrpcImage {
    const json = super.stringify(entity);

    if (_.isObject(json.file)) {
      json.file = json.file['id'];
    }

    return json;
  }
}
