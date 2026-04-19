'use client';

import { ResourceListPage } from '@/common/components';
import { GridColumnsBuilder } from '@/common/utils';
import { GrpcTempCode } from '@packages/grpc';
import { type GridColDef } from '@mui/x-data-grid';
import { AuthDatabaseEntity, Database } from '@packages/common';
import { DeleteButton, ShowButton } from '@refinedev/mui';
import React, { useMemo } from 'react';

export default function TempTokenList() {
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
      resource={AuthDatabaseEntity.TEMP_CODE}
      columns={columns}
      headerButtons={() => <></>}
    />
  );
}
