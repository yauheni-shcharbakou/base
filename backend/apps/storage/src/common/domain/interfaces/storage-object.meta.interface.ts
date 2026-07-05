import { NestStorage } from '@backend/proto';

/**
 * Validated placement for a leaf storage object (file/image/video). Carries the parent-derived
 * `folderPath`/`isPublic` produced by `StorageObjectValidationService`, which a plain
 * `NestStorage.StorageMeta` does not express. Consumed by `buildLeafStorageObject` and the
 * `saveAndPlace*` repository contracts.
 */
export interface StorageObjectPlacementMeta extends Pick<
  NestStorage.StorageMeta,
  'name' | 'isPublic' | 'parent'
> {
  folderPath?: string | null;
}
