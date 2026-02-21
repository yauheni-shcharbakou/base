'use client';

import { ResourceList } from '@/common/components/resource-list';
import { Typography } from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useMany } from '@refinedev/core';
import { DateField, DeleteButton, EditButton, List, ShowButton, useDataGrid } from '@refinedev/mui';
import React from 'react';

export default function BlogPostList() {
  const { result, dataGridProps } = useDataGrid({
    syncWithLocation: true,
  });

  const {
    result: { data: categories },
    query: { isLoading: categoryIsLoading },
  } = useMany({
    resource: 'categories',
    ids: result?.data?.map((item: any) => item?.category?.id).filter(Boolean) ?? [],
    queryOptions: {
      enabled: !!result?.data,
    },
  });

  const columns = React.useMemo<GridColDef[]>(
    () => [
      {
        field: 'id',
        headerName: 'ID',
        type: 'number',
        minWidth: 50,
        display: 'flex',
        align: 'left',
        headerAlign: 'left',
      },
      {
        field: 'title',
        headerName: 'Title',
        minWidth: 200,
        display: 'flex',
      },
      {
        field: 'content',
        flex: 1,
        headerName: 'Content',
        minWidth: 250,
        display: 'flex',
        renderCell: function render({ value }) {
          if (!value) return '-';
          return (
            <Typography component="p" whiteSpace="pre" overflow="hidden" textOverflow="ellipsis">
              {value}
            </Typography>
          );
        },
      },
      {
        field: 'category',
        headerName: 'Category',
        minWidth: 160,
        display: 'flex',
        valueGetter: (_, row) => {
          const value = row?.category;
          return value;
        },
        renderCell: function render({ value }) {
          return categoryIsLoading ? (
            <>Loading...</>
          ) : (
            categories?.find((item) => item.id === value?.id)?.title
          );
        },
      },
      {
        field: 'status',
        headerName: 'Status',
        minWidth: 80,
        display: 'flex',
      },
      {
        field: 'createdAt',
        headerName: 'Created at',
        minWidth: 120,
        display: 'flex',
        renderCell: function render({ value }) {
          return <DateField value={value} />;
        },
      },
      {
        field: 'actions',
        headerName: 'Actions',
        align: 'center',
        headerAlign: 'center',
        minWidth: 120,
        sortable: false,
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
    [categories, categoryIsLoading],
  );

  return <ResourceList {...dataGridProps} isMounted={true} columns={columns} />;
}
