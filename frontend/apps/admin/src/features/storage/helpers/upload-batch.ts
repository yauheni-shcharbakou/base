import type { CreatedUploadEntity, StorageUploadItem } from '@/features/storage/types';

// The retry rules of `useMultipleFileUpload`, kept pure so they are tested without rendering the
// hook. Imported by path rather than through the `helpers` barrel, which pulls in MUI.

// Credentials this close to expiry are not worth reusing: the pre-signed PUT is only checked when
// the request starts, but a TUS upload is checked on every PATCH and could die halfway through.
export const CREDENTIALS_EXPIRY_MARGIN_MS = 5 * 60 * 1000;

export const hasUsableCredentials = (entity: CreatedUploadEntity, now = Date.now()): boolean => {
  const expiresAt = Number(entity.upload.expires) * 1000;
  return Number.isFinite(expiresAt) && expiresAt - CREDENTIALS_EXPIRY_MARGIN_MS > now;
};

export type UploadBatchPlan = {
  // Items the create call has to make: never created, or created with credentials about to expire.
  toCreate: StorageUploadItem[];
  // Entities of an earlier attempt still fit to upload with, by item `key`. Creating those again
  // would leave the first row an orphan.
  reused: Map<string, CreatedUploadEntity>;
};

/** Splits one batch of a (re)try into what to create and what to upload with as it is. */
export const planUploadBatch = (batch: StorageUploadItem[], now = Date.now()): UploadBatchPlan => {
  const plan: UploadBatchPlan = { toCreate: [], reused: new Map() };

  for (const item of batch) {
    if (item.entity && hasUsableCredentials(item.entity, now)) {
      plan.reused.set(item.key, item.entity);
    } else {
      plan.toCreate.push(item);
    }
  }

  return plan;
};

/**
 * Keys each created entity by the item it answers. A create-many call answers in request order —
 * `result[i]` is what `items[i]` created — so a result of another length has broken that contract,
 * and is refused rather than paired by guesswork.
 */
export const pairCreatedEntities = <Entity extends CreatedUploadEntity>(
  items: StorageUploadItem[],
  entities: Entity[],
): Map<string, Entity> => {
  if (entities.length !== items.length) {
    throw new Error(
      `The create call returned ${entities.length} records for ${items.length} files`,
    );
  }

  return new Map(items.map((item, index) => [item.key, entities[index]]));
};

/**
 * Stores each created entity on the item it answers. An item removed while the create call was in
 * flight stays removed — its entity is not a reason to bring it back.
 */
export const attachCreatedEntities = (
  uploadMap: Record<string, StorageUploadItem>,
  created: Map<string, CreatedUploadEntity>,
): Record<string, StorageUploadItem> => {
  const next = { ...uploadMap };

  created.forEach((entity, key) => {
    if (next[key]) {
      next[key] = { ...next[key], entity };
    }
  });

  return next;
};
