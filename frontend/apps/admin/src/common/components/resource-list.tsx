import { LinearProgress } from '@mui/material';
import { DataGrid, DataGridProps, type GridColDef } from '@mui/x-data-grid';
import { List, ListProps } from '@refinedev/mui';
import React, { FC } from 'react';

type Props = DataGridProps & {
  columns: GridColDef[];
  isMounted: boolean;
  headerButtons?: ListProps['headerButtons'];
};

export const ResourceList: FC<Props> = ({
  columns,
  isMounted,
  headerButtons,
  ...dataGridProps
}: Props) => {
  return (
    <List
      createButtonProps={{ variant: 'outlined' }}
      wrapperProps={{
        sx: {
          backgroundColor: 'background.default',
        },
      }}
      headerButtons={headerButtons}
    >
      {isMounted ? <DataGrid {...dataGridProps} columns={columns} /> : <LinearProgress />}
    </List>
  );
};
