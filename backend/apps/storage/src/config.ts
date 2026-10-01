import { commonConfig } from '@backend/common';
import { validateEnv } from '@packages/common';
import zod from 'zod';

const env = validateEnv({
  // How long a file row may sit in PENDING/FAILED before the cleanup cron drops it. Video uploads
  // go browser -> Bunny and only reach READY once encoding finishes, so this has to outlast the
  // TUS authorization window plus Bunny's queue — an hour would delete uploads still in flight.
  STORAGE_PENDING_FILE_TTL_HOURS: zod.coerce.number().default(24),

  // Images one preview sweep takes on — each is a download of up to 100 MB, one after another.
  // The sweep runs every 10 minutes, so this is the backfill's pace: six times it an hour.
  STORAGE_IMAGE_PREVIEW_SWEEP_LIMIT: zod.coerce.number().int().positive().default(20),
  // An image READY for this long without a preview was missed by the READY event, so the sweep
  // does not race a handler that is still at work — keep it past the bus' retry ladder.
  STORAGE_IMAGE_PREVIEW_SWEEP_GRACE_MINUTES: zod.coerce.number().int().nonnegative().default(10),

  // The same pair for PDF previews — each document is a download of up to 50 MB and a render.
  STORAGE_DOCUMENT_PREVIEW_SWEEP_LIMIT: zod.coerce.number().int().positive().default(20),
  STORAGE_DOCUMENT_PREVIEW_SWEEP_GRACE_MINUTES: zod.coerce.number().int().nonnegative().default(10),
});

export const config = () => {
  return {
    ...commonConfig(),
    pendingFileTtlHours: env.STORAGE_PENDING_FILE_TTL_HOURS,
    imagePreviewSweep: {
      limit: env.STORAGE_IMAGE_PREVIEW_SWEEP_LIMIT,
      graceMinutes: env.STORAGE_IMAGE_PREVIEW_SWEEP_GRACE_MINUTES,
    },
    documentPreviewSweep: {
      limit: env.STORAGE_DOCUMENT_PREVIEW_SWEEP_LIMIT,
      graceMinutes: env.STORAGE_DOCUMENT_PREVIEW_SWEEP_GRACE_MINUTES,
    },
  } as const;
};

export type Config = ReturnType<typeof config>;
