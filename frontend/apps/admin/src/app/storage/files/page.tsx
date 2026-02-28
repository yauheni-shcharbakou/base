'use client';

import { ResourceList } from '@/common/components';
import { useResourceList } from '@/common/hooks';
import { GridColumnsBuilder } from '@/common/utils';
import { getFileSize } from '@/features/file/helpers';
import { type GridColDef } from '@mui/x-data-grid';
import { GrpcFile } from '@packages/grpc';
import { DeleteButton, ShowButton } from '@refinedev/mui';
import React, { useMemo } from 'react';

export default function FileList() {
  const { dataGridProps, isMounted } = useResourceList<GrpcFile>();

  const columns = useMemo<GridColDef<GrpcFile>[]>(
    () =>
      new GridColumnsBuilder<GrpcFile>()
        .string('originalName', { headerName: 'Name' })
        .string('extension', { maxWidth: 100 })
        .string('size', { maxWidth: 100, valueGetter: (value) => getFileSize(value) })
        .enum('uploadStatus')
        .date('createdAt')
        .date('updatedAt')
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

  return <ResourceList {...dataGridProps} isMounted={isMounted} columns={columns} />;
}
