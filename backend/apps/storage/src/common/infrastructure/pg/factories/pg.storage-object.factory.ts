import { NestStorage } from '@backend/proto';
import { StorageObjectPlacementMeta } from '@common/domain/interfaces/storage-object.meta.interface';
import { PgStorageObjectEntity } from '@common/infrastructure/pg/entities/pg.storage-object.entity';
import { RequiredEntityData } from '@mikro-orm/core';

export interface LeafStorageObjectParams {
  meta: StorageObjectPlacementMeta;
  userId: string;
  type: NestStorage.StorageObjectType;
  fileId?: string;
  imageId?: string;
  videoId?: string;
}

/**
 * Single source of truth for the persistence shape of a *leaf* storage object (the placement row that
 * accompanies a file/image/video). Owns the `type` discriminator, `isFolder: false`, and the
 * file/image/video relation wiring so the file/image/video repositories don't each duplicate it.
 *
 * Pure payload builder — no `EntityManager`; the caller does `em.create(PgStorageObjectEntity, ...)`
 * inside its own transaction.
 */
export function buildLeafStorageObject({
  meta,
  userId,
  type,
  fileId,
  imageId,
  videoId,
}: LeafStorageObjectParams): RequiredEntityData<PgStorageObjectEntity> {
  return {
    ...meta,
    userId,
    type,
    isFolder: false,
    ...(fileId ? { file: fileId } : {}),
    ...(imageId ? { image: imageId } : {}),
    ...(videoId ? { video: videoId } : {}),
  } as RequiredEntityData<PgStorageObjectEntity>;
}
