'use client';

import { CreateManyButton, ResourceList } from '@/common/components';
import { useResourceList } from '@/common/hooks';
import { GridColumnsBuilder } from '@/common/utils';
import { AddBoxOutlined } from '@mui/icons-material';
import Button from '@mui/material/Button';
import { type GridColDef } from '@mui/x-data-grid';
import { AuthDatabaseEntity, Database, StorageDatabaseEntity } from '@packages/common';
import { GrpcImagePopulated } from '@packages/grpc';
import React, { useMemo } from 'react';

export const dynamic = 'force-dynamic';

export default function ImageList() {
  const { dataGridProps, isMounted } = useResourceList<GrpcImagePopulated>();

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
        .date('updatedAt')
        .actions()
        .build(),
    [],
  );

  return (
    <ResourceList
      {...dataGridProps}
      isMounted={isMounted}
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
