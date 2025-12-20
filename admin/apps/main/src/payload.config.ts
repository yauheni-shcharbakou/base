import { DatabaseValidationSchema, validateEnv } from '@packages/common';
import { mongooseAdapter } from '@payloadcms/db-mongodb';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import Joi from 'joi';
import path from 'path';
import { buildConfig } from 'payload';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const env = validateEnv({
  ...DatabaseValidationSchema,
  PAYLOAD_SECRET: Joi.string().required(),
});

import { UserCollection } from 'src/collections/user.collection';
import { MediaCollection } from 'src/collections/media.collection';

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
  secret: env.PAYLOAD_SECRET,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({ url: env.DATABASE_URL }),
  sharp,
  plugins: [],
});
