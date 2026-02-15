'use client';

import { ResourceList } from '@/components/resource-list';
import { useResourceList } from '@/hooks/use-resource-list';
import { GridColumnsBuilder } from '@/utils/grid-columns.builder';
import { type GridColDef } from '@mui/x-data-grid';
import { GrpcUser } from '@packages/grpc';
import React, { useEffect, useMemo } from 'react';

export default function UserList() {
  const { dataGridProps, isMounted } = useResourceList<GrpcUser>();

  const columns = useMemo<GridColDef<GrpcUser>[]>(
    () =>
      new GridColumnsBuilder<GrpcUser>()
        .string('email')
        .enum('role')
        .date('createdAt')
        .date('updatedAt')
        .actions()
        .build(),
    [],
  );

  return <ResourceList {...dataGridProps} isMounted={isMounted} columns={columns} />;
}
