'use client';

import { CreateManyButton, ResourceListPage } from '@/common/components';
import { GridColumnsBuilder } from '@/common/utils';
import { type GridColDef } from '@mui/x-data-grid';
import { AuthDatabaseEntity, Database, StorageDatabaseEntity } from '@packages/common';
import { GrpcImagePopulated } from '@packages/grpc';
import React, { useMemo } from 'react';

export default function ImageList() {
  const columns = useMemo<GridColDef<GrpcImagePopulated>[]>(
    () =>
      new GridColumnsBuilder<GrpcImagePopulated>()
        .ref('userId', {
          headerName: 'User',
          database: Database.AUTH,
          resource: AuthDatabaseEntity.USER,
        })
        .ref('file', {
          database: Database.STORAGE,
          resource: StorageDatabaseEntity.FILE,
        })
        .string('alt')
        .number('width', { maxWidth: 100 })
        .number('height', { maxWidth: 100 })
        .date('createdAt')
        .actions()
        .build(),
    [],
  );

  return (
    <ResourceListPage
      resource={StorageDatabaseEntity.IMAGE}
      columns={columns}
      headerButtons={({ defaultButtons }) => (
        <>
          {defaultButtons}
          <CreateManyButton database={Database.STORAGE} resource={StorageDatabaseEntity.IMAGE} />
        </>
      )}
    />
  );
}
