// storage-adapter-import-placeholder
import { AdminValidationSchema, validateEnv } from '@packages/common';
import { mongooseAdapter } from '@payloadcms/db-mongodb';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import path from 'path';
import { buildConfig } from 'payload';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

import { UserCollection } from '@/collections/user.collection';
import { MediaCollection } from '@/collections/media.collection';

const { PAYLOAD_SECRET, MONGODB_URL } = validateEnv(AdminValidationSchema);

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  admin: {
    user: UserCollection.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [UserCollection, MediaCollection],
  editor: lexicalEditor(),
  secret: PAYLOAD_SECRET,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({ url: MONGODB_URL }),
  sharp,
  plugins: [
    // storage-adapter-placeholder
  ],
  telemetry: false,
  cors: '*',
});
