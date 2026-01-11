import { config } from '@/config';
import { MigrationCollection } from '@admin/common';
import { Database } from '@packages/common';
import { mongooseAdapter } from '@payloadcms/db-mongodb';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import path from 'path';
import { buildConfig } from 'payload';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

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
  collections: [UserCollection, MediaCollection, MigrationCollection],
  editor: lexicalEditor(),
  secret: config.payload.secret,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: config.database.url,
    connectOptions: { dbName: Database.AUTH },
  }),
  sharp,
  plugins: [],
  routes: {
    api: '/auth/api',
    graphQL: '/auth/graphql',
    graphQLPlayground: '/auth/graphqlPlayground',
  },
});
