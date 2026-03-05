import { commonConfig } from '@backend/common';
import { validateEnv } from '@packages/common';
import zod from 'zod';

const env = validateEnv({
  BUNNY_CDN_URL: zod.url(),
  BUNNY_CDN_PRIVATE_KEY: zod.string(),
  BUNNY_CDN_EXPIRES_IN_MINUTES: zod.coerce.number().default(10),

  BUNNY_STORAGE_URL: zod.url(),
  BUNNY_STORAGE_API_KEY: zod.string(),
  BUNNY_STORAGE_ZONE: zod.string(),

  BUNNY_STREAM_URL: zod.url(),
  BUNNY_STREAM_API_KEY: zod.string(),
  BUNNY_STREAM_LIBRARY_ID: zod.string(),
});

export const config = () => {
  const common = commonConfig();

  return {
    ...common,
    bunny: {
      cdn: {
        url: env.BUNNY_CDN_URL,
        privateKey: env.BUNNY_CDN_PRIVATE_KEY,
        expiresInMinutes: env.BUNNY_CDN_EXPIRES_IN_MINUTES,
      },
      storage: {
        url: env.BUNNY_STORAGE_URL,
        zone: env.BUNNY_STORAGE_ZONE,
        rootDir: common.isDevelopment ? 'dev' : 'prod',
        apiKey: env.BUNNY_STORAGE_API_KEY,
      },
      stream: {
        url: env.BUNNY_STREAM_URL,
        apiKey: env.BUNNY_STREAM_API_KEY,
        libraryId: env.BUNNY_STREAM_LIBRARY_ID,
      },
    },
  } as const;
};

export type Config = ReturnType<typeof config>;
