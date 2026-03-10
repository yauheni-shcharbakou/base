'use client';

import { ResourceList } from '@/common/components';
import { useResourceList } from '@/common/hooks';
import { GridColumnsBuilder } from '@/common/utils';
import { getVideoDuration } from '@/features/video/helpers';
import { type GridColDef } from '@mui/x-data-grid';
import { AuthDatabaseEntity, Database, StorageDatabaseEntity } from '@packages/common';
import { GrpcVideoPopulated } from '@packages/grpc';
import { EditButton, ShowButton } from '@refinedev/mui';
import React, { useMemo } from 'react';

export default function VideoList() {
  const { dataGridProps, isMounted } = useResourceList<GrpcVideoPopulated>();

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
        .date('updatedAt')
        .actions({
          renderCell: function render({ row }) {
            return (
              <>
                <ShowButton hideText recordItemId={row.id} />
                <EditButton hideText recordItemId={row.id} />
              </>
            );
          },
        })
        .build(),
    [],
  );

  return <ResourceList {...dataGridProps} isMounted={isMounted} columns={columns} />;
}
