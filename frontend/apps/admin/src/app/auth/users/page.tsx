'use client';

import { ResourceListPage } from '@/common/components';
import { GridColumnsBuilder } from '@/common/utils';
import { type GridColDef } from '@mui/x-data-grid';
import { AuthDatabaseEntity } from '@packages/common';
import type { BrowserAuth } from '@packages/proto';
import React, { useMemo } from 'react';

export default function UserList() {
  const columns = useMemo<GridColDef<BrowserAuth.User>[]>(
    () =>
      new GridColumnsBuilder<BrowserAuth.User>()
        .string('email')
        .enum('role')
        .date('createdAt')
        .actions()
        .build(),
    [],
  );

  return <ResourceListPage resource={AuthDatabaseEntity.USER} columns={columns} />;
}
