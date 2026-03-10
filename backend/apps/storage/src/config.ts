import { commonConfig } from '@backend/common';
import { validateEnv } from '@packages/common';
import zod from 'zod';

const env = validateEnv({
  BUNNY_STORAGE_URL: zod.url(),
  BUNNY_STORAGE_API_KEY: zod.string(),

  BUNNY_STORAGE_CDN_ZONE: zod.string(),
  BUNNY_STORAGE_CDN_PRIVATE_KEY: zod.string(),
  BUNNY_STORAGE_CDN_EXPIRES_IN_MINUTES: zod.coerce.number().default(10),

  BUNNY_STREAM_URL: zod.url(),
  BUNNY_STREAM_API_KEY: zod.string(),
  BUNNY_STREAM_LIBRARY_ID: zod.string(),

  BUNNY_STREAM_CDN_ZONE: zod.string(),
  BUNNY_STREAM_CDN_PRIVATE_KEY: zod.string(),
  BUNNY_STREAM_CDN_EXPIRES_IN_MINUTES: zod.coerce.number().default(60),
});

export const config = () => {
  const common = commonConfig();

  return {
    ...common,
    bunny: {
      storage: {
        url: env.BUNNY_STORAGE_URL,
        rootDir: common.isDevelopment ? 'dev' : 'prod',
        apiKey: env.BUNNY_STORAGE_API_KEY,
        cdn: {
          zone: env.BUNNY_STORAGE_CDN_ZONE,
          privateKey: env.BUNNY_STORAGE_CDN_PRIVATE_KEY,
          expiresInMinutes: env.BUNNY_STORAGE_CDN_EXPIRES_IN_MINUTES,
        },
      },
      stream: {
        url: env.BUNNY_STREAM_URL,
        apiKey: env.BUNNY_STREAM_API_KEY,
        libraryId: env.BUNNY_STREAM_LIBRARY_ID,
        cdn: {
          zone: env.BUNNY_STREAM_CDN_ZONE,
          privateKey: env.BUNNY_STREAM_CDN_PRIVATE_KEY,
          expiresInMinutes: env.BUNNY_STREAM_CDN_EXPIRES_IN_MINUTES,
        },
      },
    },
  } as const;
};

export type Config = ReturnType<typeof config>;
