'use client';

import { ResourceList } from '@/common/components';
import { useResourceList } from '@/common/hooks';
import { GridColumnsBuilder } from '@/common/utils';
import { type GridColDef } from '@mui/x-data-grid';
import { GrpcImage } from '@packages/grpc';
import { EditButton, ShowButton } from '@refinedev/mui';
import React, { useMemo } from 'react';

export default function ImageList() {
  const { dataGridProps, isMounted } = useResourceList<GrpcImage>();

  const columns = useMemo<GridColDef<GrpcImage>[]>(
    () =>
      new GridColumnsBuilder<GrpcImage>()
        .string('file')
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
