import { DataGrid, DataGridProps, type GridColDef } from '@mui/x-data-grid';
import { List } from '@refinedev/mui';
import React, { FC } from 'react';

type Props = DataGridProps & {
  columns: GridColDef[];
};

export const ResourceList: FC<Props> = ({ columns, ...dataGridProps }) => {
  return (
    <List
      createButtonProps={{ variant: 'outlined' }}
      wrapperProps={{
        sx: {
          backgroundColor: 'background.default',
        },
      }}
    >
      <DataGrid {...dataGridProps} columns={columns} />
    </List>
  );
};
