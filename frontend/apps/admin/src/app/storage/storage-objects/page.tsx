'use client';

import { ResourceList } from '@/common/components';
import { useResourceList } from '@/common/hooks';
import { GridColumnsBuilder } from '@/common/utils';
import { type GridColDef } from '@mui/x-data-grid';
import { GrpcStorageObjectPopulated } from '@packages/grpc';
import React, { useMemo } from 'react';

export default function FileList() {
  const { dataGridProps, isMounted } = useResourceList<GrpcStorageObjectPopulated>();

  const columns = useMemo<GridColDef<GrpcStorageObjectPopulated>[]>(
    () =>
      new GridColumnsBuilder<GrpcStorageObjectPopulated>()
        .string('name', { valueGetter: (value) => value || 'Root Folder' })
        .enum('type', { maxWidth: 100 })
        .boolean('isPublic', { maxWidth: 100 })
        .string('file.mimeType', { headerName: 'MimeType' })
        .date('createdAt')
        .date('updatedAt')
        .actions()
        .build(),
    [],
  );

  return <ResourceList {...dataGridProps} isMounted={isMounted} columns={columns} />;
}
