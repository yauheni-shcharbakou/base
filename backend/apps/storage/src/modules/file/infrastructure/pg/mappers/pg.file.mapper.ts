import { PgMapper } from '@backend/pg';
import { NestStorage } from '@backend/proto';
import { PgFileEntity } from '@common/infrastructure/pg/entities/pg.file.entity';
import {
  isBackingFilter,
  isPlacedFilter,
} from '@common/infrastructure/pg/factories/pg.media.filters';
import { ObjectQuery, serialize } from '@mikro-orm/core';

export class PgFileMapper extends PgMapper<PgFileEntity, NestStorage.File, NestStorage.FileQuery> {
  protected readonly computedFilters = {
    isPlaced: isPlacedFilter<PgFileEntity>(),
    isBacking: isBackingFilter<PgFileEntity>(),
  };

  transformQuery({
    mimeTypes,
    userIds,
    uploadStatuses,
    createdBefore,
    ...rest
  }: Partial<NestStorage.FileQuery>): ObjectQuery<PgFileEntity> {
    const result = super.transformQuery(rest);

    if (mimeTypes?.length) {
      result.mimeType = { $in: mimeTypes };
    }

    if (userIds?.length) {
      result.userId = { $in: userIds };
    }

    if (uploadStatuses?.length) {
      result.uploadStatus = { $in: uploadStatuses };
    }

    if (createdBefore) {
      result.createdAt = { $lte: createdBefore };
    }

    return result;
  }

  // The contract is the file alone; the cleanup paths read it with its image and video
  // (`FileWithMedia`). Never its storage object, which walks its whole folder — see the image
  // mapper. Excluded paths are never visited.
  stringify(entity: PgFileEntity): NestStorage.File {
    return serialize(entity, {
      populate: ['image', 'video'],
      // `image` and `video` are typed as the proto messages, which have no relations, so the paths
      // past them do not type-check; the metadata does have them.
      exclude: [
        'storageObject',
        'image.storageObject',
        'image.file',
        'video.storageObject',
        'video.file',
      ] as never[],
    });
  }
}
