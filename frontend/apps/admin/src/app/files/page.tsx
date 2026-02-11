'use client';

import { ResourceList } from '@/components/resource-list';
import { useResourceList } from '@/hooks/use-resource-list';
import { GridColumnsBuilder } from '@/utils/grid-columns.builder';
import { type GridColDef } from '@mui/x-data-grid';
import { GrpcFile } from '@packages/grpc';
import React, { useMemo } from 'react';

export default function FileList() {
  const { dataGridProps, isMounted } = useResourceList<GrpcFile>();

  const columns = useMemo<GridColDef<GrpcFile>[]>(
    () =>
      new GridColumnsBuilder<GrpcFile>()
        .string('name')
        .string('mimeType')
        .boolean('isPublic')
        .date('createdAt')
        .date('updatedAt')
        .actions()
        .build(),
    [],
  );

  return <ResourceList {...dataGridProps} isMounted={isMounted} columns={columns} />;
}
