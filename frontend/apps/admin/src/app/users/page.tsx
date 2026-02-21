'use client';

import { ResourceList } from '@/common/components';
import { useResourceList } from '@/common/hooks';
import { GridColumnsBuilder } from '@/common/utils';
import { type GridColDef } from '@mui/x-data-grid';
import { GrpcUser } from '@packages/grpc';
import React, { useMemo } from 'react';

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
