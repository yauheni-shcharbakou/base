'use client';

import { ResourceList } from '@/common/components';
import { useResourceList } from '@/common/hooks';
import { GridColumnsBuilder } from '@/common/utils';
import { type GridColDef } from '@mui/x-data-grid';
import { AuthDatabaseEntity, Database, StorageDatabaseEntity } from '@packages/common';
import { GrpcImagePopulated } from '@packages/grpc';
import { EditButton, ShowButton } from '@refinedev/mui';
import React, { useMemo } from 'react';

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
        .actions({
          renderCell: function render({ row }) {
            return (
              <>
                <EditButton hideText recordItemId={row.id} />
                <ShowButton hideText recordItemId={row.id} />
              </>
            );
          },
        })
        .build(),
    [],
  );

  return <ResourceList {...dataGridProps} isMounted={isMounted} columns={columns} />;
}
