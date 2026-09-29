'use client';

import NavigateNextRounded from '@mui/icons-material/NavigateNextRounded';
import { Breadcrumbs, Link, Typography } from '@mui/material';
import { AuthDatabaseEntity } from '@packages/common';
import type { BrowserAuth, BrowserStorage } from '@packages/proto';
import { useOne } from '@refinedev/core';
import NextLink from 'next/link';
import React, { FC } from 'react';

type Props = {
  folder: BrowserStorage.StorageObject;
  ancestors: BrowserStorage.StorageObjectAncestor[];
  // An ancestor's link, with the folder that leads back down marked.
  getAncestorHref: (id: string) => string;
};

/**
 * The path from the owner's root down to this folder, as Drive's title shows it. A root has no
 * name, so it goes by its owner's email.
 */
export const FolderBreadcrumbs: FC<Props> = ({ folder, ancestors, getAncestorHref }) => {
  const { query } = useOne<BrowserAuth.User>({
    resource: AuthDatabaseEntity.USER,
    id: folder.userId,
    queryOptions: { enabled: !!folder.userId },
    errorNotification: false,
  });

  const rootLabel = query.data?.data?.email ? `${query.data.data.email}’s storage` : 'Root folder';
  const labelOf = (name: string) => name || rootLabel;

  return (
    <Breadcrumbs
      separator={<NavigateNextRounded fontSize="small" />}
      aria-label="Folder path"
      sx={{ '& .MuiBreadcrumbs-ol': { flexWrap: 'wrap' } }}
    >
      {ancestors.map((ancestor) => (
        <Link
          key={ancestor.id}
          component={NextLink}
          href={getAncestorHref(ancestor.id)}
          underline="hover"
          color="text.secondary"
          variant="h6"
          fontWeight={400}
        >
          {labelOf(ancestor.name)}
        </Link>
      ))}
      <Typography variant="h6" color="text.primary" aria-current="page">
        {labelOf(folder.name)}
      </Typography>
    </Breadcrumbs>
  );
};
