import { commonConfig } from '@backend/common';
import { validateEnv } from '@packages/common';
import zod from 'zod';

const env = validateEnv({
  BUNNY_STORAGE_API_KEY: zod.string(),

  BUNNY_STORAGE_CDN_ZONE: zod.string(),
  BUNNY_STORAGE_CDN_PRIVATE_KEY: zod.string(),
  BUNNY_STORAGE_CDN_EXPIRES_IN_MINUTES: zod.coerce.number().default(10),

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
        apiUrl: `https://storage.bunnycdn.com/${env.BUNNY_STORAGE_CDN_ZONE}`,
        apiKey: env.BUNNY_STORAGE_API_KEY,
        rootDir: common.isDevelopment ? 'dev' : 'prod',
        cdn: {
          url: `https://${env.BUNNY_STORAGE_CDN_ZONE}.b-cdn.net`,
          privateKey: env.BUNNY_STORAGE_CDN_PRIVATE_KEY,
          expiresInMinutes: env.BUNNY_STORAGE_CDN_EXPIRES_IN_MINUTES,
        },
      },
      stream: {
        apiUrl: `https://video.bunnycdn.com/library/${env.BUNNY_STREAM_LIBRARY_ID}`,
        apiKey: env.BUNNY_STREAM_API_KEY,
        playerUrl: `https://player.mediadelivery.net/embed/${env.BUNNY_STREAM_LIBRARY_ID}`,
        cdn: {
          url: `https://${env.BUNNY_STREAM_CDN_ZONE}.b-cdn.net`,
          privateKey: env.BUNNY_STREAM_CDN_PRIVATE_KEY,
          expiresInMinutes: env.BUNNY_STREAM_CDN_EXPIRES_IN_MINUTES,
        },
      },
    },
  } as const;
};

export type Config = ReturnType<typeof config>;
