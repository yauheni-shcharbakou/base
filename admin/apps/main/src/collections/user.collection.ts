import { MainDatabaseCollection } from '@packages/common';
import type { CollectionConfig } from 'payload';

export const UserCollection: CollectionConfig = {
  slug: MainDatabaseCollection.USER,
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  fields: [
    // Email added by default
    // Add more fields as needed
  ],
};
