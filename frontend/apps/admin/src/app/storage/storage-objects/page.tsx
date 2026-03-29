'use client';

import { ResourceList } from '@/common/components';
import { useResourceList } from '@/common/hooks';
import { GridColumnsBuilder } from '@/common/utils';
import { type GridColDef } from '@mui/x-data-grid';
import { AuthDatabaseEntity, Database, StorageDatabaseEntity } from '@packages/common';
import { GrpcStorageObjectPopulated } from '@packages/grpc';
import React, { useMemo } from 'react';

export const dynamic = 'force-dynamic';

export default function StorageObjectList() {
  const { dataGridProps, isMounted } = useResourceList<GrpcStorageObjectPopulated>();

  const columns = useMemo<GridColDef<GrpcStorageObjectPopulated>[]>(
    () =>
      new GridColumnsBuilder<GrpcStorageObjectPopulated>()
        .ref('userId', {
          headerName: 'User',
          database: Database.AUTH,
          resource: AuthDatabaseEntity.USER,
        })
        .ref('file', {
          database: Database.STORAGE,
          resource: StorageDatabaseEntity.FILE,
        })
        .ref('image', {
          database: Database.STORAGE,
          resource: StorageDatabaseEntity.IMAGE,
        })
        .ref('video', {
          database: Database.STORAGE,
          resource: StorageDatabaseEntity.VIDEO,
        })
        .string('name', { valueGetter: (value) => value || 'Root Folder' })
        .enum('type', { maxWidth: 100 })
        .boolean('isPublic', { maxWidth: 100 })
        .date('createdAt')
        .date('updatedAt')
        .actions()
        .build(),
    [],
  );

  return <ResourceList {...dataGridProps} isMounted={isMounted} columns={columns} />;
}
