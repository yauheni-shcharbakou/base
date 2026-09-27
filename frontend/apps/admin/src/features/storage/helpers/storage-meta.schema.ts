import zod from 'zod';

/**
 * The fields `StorageObjectMetaFormSection` renders, for the forms that create media and may place
 * it in a folder. `isPublic` (and a page's `name`) only mount once a parent is picked, and a field
 * that never mounts never registers a value — so each one has to be optional, or the form stays
 * invalid until a folder is picked. Without a parent the providers create no
 * storage object and default `isPublic` to `false`.
 */
export const storageMetaSchema = {
  parent: zod.string().optional(),
  isPublic: zod.boolean().optional(),
};
