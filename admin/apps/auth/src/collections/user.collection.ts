import { config } from '@/config';
import { AdminCollectionGroup, AuthDatabaseCollection } from '@packages/common';
import { UserRole } from '@packages/grpc.js';
import _ from 'lodash';
import type { CollectionConfig } from 'payload';

export const UserCollection: CollectionConfig = {
  slug: AuthDatabaseCollection.USER,
  admin: {
    useAsTitle: 'email',
    group: AdminCollectionGroup.AUTH,
  },
  auth: {
    tokenExpiration: config.isDevelopment ? 24 * 60 * 60 : 10 * 60,
    maxLoginAttempts: 10,
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      options: _.values(UserRole),
      defaultValue: UserRole.USER,
    },
  ],
};
