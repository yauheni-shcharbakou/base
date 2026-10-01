import { commonConfig } from '@backend/common';
import { validateEnv } from '@packages/common';
import zod from 'zod';

const env = validateEnv({
  // How long a file row may sit in PENDING/FAILED before the cleanup cron drops it. Video uploads
  // go browser -> Bunny and only reach READY once encoding finishes, so this has to outlast the
  // TUS authorization window plus Bunny's queue — an hour would delete uploads still in flight.
  STORAGE_PENDING_FILE_TTL_HOURS: zod.coerce.number().default(24),
});

export const config = () => {
  return {
    ...commonConfig(),
    pendingFileTtlHours: env.STORAGE_PENDING_FILE_TTL_HOURS,
  } as const;
};

export type Config = ReturnType<typeof config>;
