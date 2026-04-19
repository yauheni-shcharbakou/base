'use client';

import { CreateManyButton, ResourceListPage } from '@/common/components';
import { GridColumnsBuilder } from '@/common/utils';
import { getVideoDuration } from '@/features/video/helpers';
import { type GridColDef } from '@mui/x-data-grid';
import { AuthDatabaseEntity, Database, StorageDatabaseEntity } from '@packages/common';
import { GrpcVideoPopulated } from '@packages/grpc';
import React, { useMemo } from 'react';

export default function VideoList() {
  const columns = useMemo<GridColDef<GrpcVideoPopulated>[]>(
    () =>
      new GridColumnsBuilder<GrpcVideoPopulated>()
        .ref('userId', {
          headerName: 'User',
          database: Database.AUTH,
          resource: AuthDatabaseEntity.USER,
        })
        .ref('file', {
          database: Database.STORAGE,
          resource: StorageDatabaseEntity.FILE,
        })
        .string('title')
        .string('description')
        .string('duration', { maxWidth: 100, valueGetter: (value) => getVideoDuration(value) })
        .number('views', { maxWidth: 100 })
        .date('createdAt')
        .actions()
        .build(),
    [],
  );

  return (
    <ResourceListPage
      resource={StorageDatabaseEntity.VIDEO}
      columns={columns}
      headerButtons={({ defaultButtons }) => (
        <>
          {defaultButtons}
          <CreateManyButton database={Database.STORAGE} resource={StorageDatabaseEntity.VIDEO} />
        </>
      )}
    />
  );
}
