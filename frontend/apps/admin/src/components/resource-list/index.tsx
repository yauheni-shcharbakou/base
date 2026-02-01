import { LinearProgress } from '@mui/material';
import { DataGrid, DataGridProps, type GridColDef } from '@mui/x-data-grid';
import { List } from '@refinedev/mui';
import React, { FC } from 'react';

type Props = DataGridProps & {
  columns: GridColDef[];
  isMounted: boolean;
};

export const ResourceList: FC<Props> = ({ columns, isMounted, ...dataGridProps }) => {
  return (
    <List
      createButtonProps={{ variant: 'outlined' }}
      wrapperProps={{
        sx: {
          backgroundColor: 'background.default',
        },
      }}
    >
      {isMounted ? <DataGrid {...dataGridProps} columns={columns} /> : <LinearProgress />}
    </List>
  );
};
