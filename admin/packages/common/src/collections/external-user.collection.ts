import { AdminCollectionGroup, CommonDatabaseCollection } from '@packages/common';
import { UserRole } from '@packages/grpc.js';
import { adminConfig } from 'configs';
import { AdminAccessGuard } from 'guards';
import _ from 'lodash';
import { CollectionConfig } from 'payload';
import { ExternalAuthStrategy } from 'strategies';

export const externalUserCollection = (
  config: ReturnType<typeof adminConfig<true>>,
): CollectionConfig => {
  return {
    slug: CommonDatabaseCollection.EXTERNAL_USER,
    access: {
      read: AdminAccessGuard.onlyAdmin,
      admin: AdminAccessGuard.onlyAdmin,
      create: AdminAccessGuard.disabled,
      update: AdminAccessGuard.disabled,
      delete: AdminAccessGuard.disabled,
      unlock: AdminAccessGuard.disabled,
    },
    admin: {
      useAsTitle: 'email',
      listSearchableFields: ['externalId', 'email', 'role'],
      group: AdminCollectionGroup.SYSTEM,
    },
    timestamps: false,
    auth: {
      disableLocalStrategy: true,
      strategies: [new ExternalAuthStrategy(config.auth.url)],
    },
    fields: [
      {
        name: 'externalId',
        type: 'text',
        index: true,
        required: true,
        unique: true,
      },
      {
        name: 'email',
        type: 'text',
        index: true,
        required: true,
        unique: true,
      },
      {
        name: 'role',
        type: 'select',
        options: _.values(UserRole),
        defaultValue: UserRole.USER,
      },
    ],
  };
};
