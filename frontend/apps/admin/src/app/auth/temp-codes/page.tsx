'use client';

import { ResourceList } from '@/common/components';
import { useResourceList } from '@/common/hooks';
import { GridColumnsBuilder } from '@/common/utils';
import { GrpcTempCode } from '@backend/grpc';
import { type GridColDef } from '@mui/x-data-grid';
import { AuthDatabaseEntity, Database } from '@packages/common';
import { DeleteButton, ShowButton } from '@refinedev/mui';
import React, { useMemo } from 'react';

export const dynamic = 'force-dynamic';

export default function TempTokenList() {
  const { dataGridProps, isMounted } = useResourceList<GrpcTempCode>();

  const columns = useMemo<GridColDef<GrpcTempCode>[]>(
    () =>
      new GridColumnsBuilder<GrpcTempCode>()
        .ref('userId', {
          database: Database.AUTH,
          resource: AuthDatabaseEntity.USER,
        })
        .boolean('isActive')
        .string('code')
        .date('expiredAt')
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

  return (
    <ResourceList
      {...dataGridProps}
      isMounted={isMounted}
      columns={columns}
      headerButtons={() => <></>}
    />
  );
}
