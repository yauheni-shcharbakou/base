import { PgMapper } from '@backend/pg';
import { NestStorage } from '@backend/proto';
import { PgFileEntity } from '@common/infrastructure/pg/entities/pg.file.entity';
import {
  isBackingFilter,
  isPlacedFilter,
} from '@common/infrastructure/pg/factories/pg.media.filters';
import { ObjectQuery } from '@mikro-orm/core';

export class PgFileMapper extends PgMapper<PgFileEntity, NestStorage.File, NestStorage.FileQuery> {
  // The cleanup paths read a file with its image and video (`FileWithMedia`). Never a storage
  // object, which leads to its folder and every sibling there.
  protected readonly populate = ['image', 'video'];
  protected readonly exclude = [
    'storageObject',
    'image.storageObject',
    'image.file',
    'video.storageObject',
    'video.file',
  ];

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
}
