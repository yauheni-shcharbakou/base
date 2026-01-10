import { config } from '@/config';
import { externalUserCollection, MigrationCollection } from '@admin/common';
import { mongooseAdapter } from '@payloadcms/db-mongodb';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import path from 'path';
import { buildConfig } from 'payload';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

import { MediaCollection } from 'src/collections/media.collection';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const userCollection = externalUserCollection(config);

export default buildConfig({
  admin: {
    user: userCollection.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [userCollection, MediaCollection, MigrationCollection],
  editor: lexicalEditor(),
  secret: config.payload.secret,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: config.database.url,
    connectOptions: { dbName: 'main' },
  }),
  sharp,
  plugins: [],
  routes: {
    api: '/main/api',
    graphQL: '/main/graphql',
    graphQLPlayground: '/main/graphql-playground',
  },
});
