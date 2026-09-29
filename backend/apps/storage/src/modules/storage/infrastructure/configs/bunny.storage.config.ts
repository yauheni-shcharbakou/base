import { commonConfig } from '@backend/common';
import { validateEnv } from '@packages/common';
import zod from 'zod';

const env = validateEnv({
  // The S3-enabled storage zone: its name is the bucket and the S3 access key id, its password
  // (Storage > Access) is both the S3 secret and the HTTP API AccessKey.
  BUNNY_STORAGE_ZONE: zod.string(),
  BUNNY_STORAGE_API_KEY: zod.string(),
  BUNNY_STORAGE_S3_REGION: zod
    .enum(['de', 'ny', 'uk', 'se', 'sg', 'la', 'jh', 'syd'])
    .default('de'),
  // How long a pre-signed PUT URL stays valid. Checked when the request starts, not when it ends,
  // but a batch signs every file up front and uploads them one by one — the last file of a large
  // batch starts late. Bunny accepts up to 7 days.
  BUNNY_STORAGE_UPLOAD_EXPIRES_IN_MINUTES: zod.coerce.number().min(1).max(10_080).default(60),

  // The pull zone serving the storage zone — its own name, not necessarily the storage zone's.
  BUNNY_STORAGE_CDN_ZONE: zod.string(),
  BUNNY_STORAGE_CDN_PRIVATE_KEY: zod.string(),
  // A signed read URL's lifetime, and the window its expiry is rounded up to: a URL lives between
  // one and two of these, and URLs signed within one window are identical.
  BUNNY_STORAGE_CDN_EXPIRES_IN_MINUTES: zod.coerce.number().min(1).default(10),

  BUNNY_STREAM_API_KEY: zod.string(),
  BUNNY_STREAM_READ_ONLY_API_KEY: zod.string(),
  BUNNY_STREAM_LIBRARY_ID: zod.string(),

  BUNNY_STREAM_CDN_ZONE: zod.string(),
  BUNNY_STREAM_CDN_PRIVATE_KEY: zod.string(),
  BUNNY_STREAM_CDN_EXPIRES_IN_MINUTES: zod.coerce.number().min(1).default(60),

  // Bunny requires a TUS authorization window of at least an hour, and refuses the upload once
  // it passes — a resumed upload is re-signed, never extended.
  BUNNY_STREAM_TUS_EXPIRES_IN_MINUTES: zod.coerce.number().min(60).default(120),
});

export const bunnyStorageConfig = () => {
  const common = commonConfig();

  return {
    ...common,
    bunny: {
      storage: {
        s3: {
          endpoint: `https://${env.BUNNY_STORAGE_S3_REGION}-s3.storage.bunnycdn.com`,
          region: env.BUNNY_STORAGE_S3_REGION,
          bucket: env.BUNNY_STORAGE_ZONE,
          accessKeyId: env.BUNNY_STORAGE_ZONE,
          secretAccessKey: env.BUNNY_STORAGE_API_KEY,
          uploadExpiresInMinutes: env.BUNNY_STORAGE_UPLOAD_EXPIRES_IN_MINUTES,
        },
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
        // Signs the Bunny Stream status webhook — a different key than the one that writes.
        readOnlyApiKey: env.BUNNY_STREAM_READ_ONLY_API_KEY,
        // The library id goes into the TUS signature and the LibraryId header, not just the URL.
        libraryId: env.BUNNY_STREAM_LIBRARY_ID,
        playerUrl: `https://player.mediadelivery.net/embed/${env.BUNNY_STREAM_LIBRARY_ID}`,
        tus: {
          url: 'https://video.bunnycdn.com/tusupload',
          expiresInMinutes: env.BUNNY_STREAM_TUS_EXPIRES_IN_MINUTES,
        },
        cdn: {
          url: `https://${env.BUNNY_STREAM_CDN_ZONE}.b-cdn.net`,
          privateKey: env.BUNNY_STREAM_CDN_PRIVATE_KEY,
          expiresInMinutes: env.BUNNY_STREAM_CDN_EXPIRES_IN_MINUTES,
        },
      },
    },
  } as const;
};

export type BunnyStorageConfig = ReturnType<typeof bunnyStorageConfig>;
