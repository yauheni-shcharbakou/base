'use client';

import { ResourceList } from '@/components/resource-list';
import { useResourceList } from '@/hooks/use-resource-list';
import { type GridColDef } from '@mui/x-data-grid';
import { User } from '@packages/grpc';
import { DeleteButton, EditButton, ShowButton } from '@refinedev/mui';
import React from 'react';

export default function UserList() {
  const { dataGridProps } = useResourceList<User>();

  const columns = React.useMemo<GridColDef<User>[]>(
    () => [
      {
        field: 'id',
        headerName: 'ID',
        type: 'string',
        minWidth: 200,
        display: 'flex',
        align: 'left',
        headerAlign: 'left',
        filterable: false,
      },
      {
        field: 'email',
        headerName: 'Email',
        type: 'string',
        minWidth: 200,
        display: 'flex',
        flex: 1,
      },
      {
        field: 'role',
        headerName: 'Role',
        type: 'singleSelect',
        minWidth: 80,
        display: 'flex',
      },
      {
        field: 'actions',
        headerName: 'Actions',
        align: 'center',
        headerAlign: 'center',
        minWidth: 120,
        sortable: false,
        filterable: false,
        display: 'flex',
        renderCell: function render({ row }) {
          return (
            <>
              <EditButton hideText recordItemId={row.id} />
              <ShowButton hideText recordItemId={row.id} />
              <DeleteButton hideText recordItemId={row.id} />
            </>
          );
        },
      },
    ],
    [],
  );

  return <ResourceList {...dataGridProps} columns={columns} />;
}
