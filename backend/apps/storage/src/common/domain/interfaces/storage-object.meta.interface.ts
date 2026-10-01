import { NestStorage } from '@backend/proto';

/**
 * Validated placement for a leaf storage object (file/image/video): its name, parent and the
 * `isPublic` produced by `StorageObjectValidationService`. Consumed by `buildLeafStorageObject` and
 * the `saveAndPlace*` repository contracts.
 */
export type StorageObjectPlacementMeta = Pick<
  NestStorage.StorageMeta,
  'name' | 'isPublic' | 'parent'
>;
