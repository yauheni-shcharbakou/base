'use client';

import { CreateManyButton, ResourceListPage } from '@/common/components';
import { GridColumnsBuilder } from '@/common/utils';
import { getFileSize } from '@/features/storage/helpers';
import { type GridColDef } from '@mui/x-data-grid';
import { AuthDatabaseEntity, Database, StorageDatabaseEntity } from '@packages/common';
import type { BrowserStorage } from '@packages/proto';
import { DeleteButton, ShowButton } from '@refinedev/mui';
import React, { useMemo } from 'react';

export default function FileList() {
  const columns = useMemo<GridColDef<BrowserStorage.File>[]>(
    () =>
      new GridColumnsBuilder<BrowserStorage.File>()
        .ref('userId', {
          headerName: 'User',
          database: Database.AUTH,
          resource: AuthDatabaseEntity.USER,
        })
        .string('originalName', { headerName: 'Name' })
        .string('extension', { maxWidth: 100, align: 'center' })
        .string('size', { maxWidth: 100, valueGetter: (value) => getFileSize(value) })
        .enum('uploadStatus')
        .date('createdAt')
        .actions({
          renderCell: function render({ row }) {
            return (
              <>
                <ShowButton hideText recordItemId={row.id} />
                <DeleteButton hideText recordItemId={row.id} />
              </>
            );
          },
        })
        .build(),
    [],
  );

  return (
    <ResourceListPage
      resource={StorageDatabaseEntity.FILE}
      columns={columns}
      headerButtons={({ defaultButtons }) => (
        <>
          {defaultButtons}
          <CreateManyButton database={Database.STORAGE} resource={StorageDatabaseEntity.FILE} />
        </>
      )}
    />
  );
}
