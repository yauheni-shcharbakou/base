import { AdminCollectionGroup } from '@packages/common';
import type { CollectionConfig } from 'payload';

export const MediaCollection: CollectionConfig = {
  slug: 'media',
  admin: {
    group: AdminCollectionGroup.SYSTEM,
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: true,
};
