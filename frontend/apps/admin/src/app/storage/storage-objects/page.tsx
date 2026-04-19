'use client';

import { ResourceListPage } from '@/common/components';
import { GridColumnsBuilder } from '@/common/utils';
import { type GridColDef } from '@mui/x-data-grid';
import { AuthDatabaseEntity, Database, StorageDatabaseEntity } from '@packages/common';
import { GrpcStorageObjectPopulated } from '@packages/grpc';
import React, { useMemo } from 'react';

export default function StorageObjectList() {
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
        .actions()
        .build(),
    [],
  );

  return <ResourceListPage resource={StorageDatabaseEntity.STORAGE_OBJECT} columns={columns} />;
}
