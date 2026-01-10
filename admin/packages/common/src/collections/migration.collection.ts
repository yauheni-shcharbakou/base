import { AdminCollectionGroup, CommonDatabaseCollection, MigrationStatus } from '@packages/common';
import { AdminAccessGuard } from 'guards';
import _ from 'lodash';
import { CollectionConfig } from 'payload';

export const MigrationCollection: CollectionConfig = {
  slug: CommonDatabaseCollection.MIGRATION,
  admin: {
    useAsTitle: 'name',
    listSearchableFields: ['name', 'status'],
    group: AdminCollectionGroup.SYSTEM,
  },
  access: {
    read: AdminAccessGuard.onlyAdmin,
    create: AdminAccessGuard.onlyAdmin,
    update: AdminAccessGuard.onlyAdmin,
    delete: AdminAccessGuard.onlyAdmin,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      index: true,
      required: true,
      unique: true,
      access: {
        create: AdminAccessGuard.disabled,
        update: AdminAccessGuard.disabled,
      },
    },
    {
      name: 'status',
      type: 'select',
      index: true,
      required: true,
      options: _.values(MigrationStatus),
    },
    {
      name: 'errorMessage',
      type: 'text',
      required: false,
    },
    {
      name: 'errorStack',
      type: 'textarea',
      required: false,
    },
  ],
};
