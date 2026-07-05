'use client';

/**
 * ⚠️ DO NOT "simplify" this page to Refine's built-in `syncWithLocation`
 * (`<DataGrid {...dataGridProps} />` without the mount gate). That has been tried
 * and reverted.
 *
 * The manual URL sync + `isMounted` gate below is deliberate and load-bearing:
 *  - `enabled: () => isMounted` + rendering a placeholder until mount keeps the
 *    DataGrid from mounting during SSR / first render.
 *  - Without it Refine does NOT fire the initial `getList` (the page hangs on an
 *    infinite loading state) and React throws:
 *    "Can't perform a React state update on a component that hasn't mounted yet."
 *
 * Keep this approach. The empty-deps mount effect is intentional.
 */

import { AppBreadcrumb } from '@/common/components';
import { LinearProgress } from '@mui/material';
import {
  DataGrid,
  GridCallbackDetails,
  type GridColDef,
  GridPaginationModel,
  GridSortModel,
} from '@mui/x-data-grid';
import { CrudSort } from '@refinedev/core';
import { List, ListProps, useDataGrid } from '@refinedev/mui';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { FC, useEffect, useState } from 'react';

type ResourceListProps = {
  resource: string;
  columns: GridColDef[];
  headerButtons?: ListProps['headerButtons'];
};

export const ResourceListPage: FC<ResourceListProps> = ({ columns, headerButtons, resource }) => {
  const [isMounted, setIsMounted] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialPage = Number(searchParams.get('currentPage')) || 1;
  const initialPageSize = Number(searchParams.get('pageSize')) || 25;
  const initialSortBy = searchParams.get('sortBy');
  const initialSortOrder = searchParams.get('sortOrder') as CrudSort['order'] | null;

  const initialSorter: CrudSort =
    initialSortBy && initialSortOrder
      ? { field: initialSortBy, order: initialSortOrder }
      : { field: 'id', order: 'desc' };

  useEffect(() => {
    setIsMounted(() => true);
    const params = new URLSearchParams(searchParams.toString());

    params.set('currentPage', initialPage.toString());
    params.set('pageSize', initialPageSize.toString());
    params.set('sortBy', initialSorter.field);
    params.set('sortOrder', initialSorter.order);

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    // Intentionally run once on mount — do not add deps (see the note at the top).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { dataGridProps } = useDataGrid({
    syncWithLocation: false,
    resource,
    queryOptions: {
      enabled: () => isMounted,
      retry: 3,
      retryDelay: 1_000,
    },
    pagination: {
      currentPage: initialPage,
      pageSize: initialPageSize,
    },
    sorters: {
      initial: [initialSorter],
    },
  });

  const handlePaginationModelChange = (
    model: GridPaginationModel,
    details: GridCallbackDetails<'pagination'>,
  ) => {
    const newPage = model.page + 1;
    const newPageSize = model.pageSize;

    const params = new URLSearchParams(searchParams.toString());
    params.set('currentPage', newPage.toString());
    params.set('pageSize', newPageSize.toString());

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    dataGridProps.onPaginationModelChange?.(model, details);
  };

  const handleSortModelChange = (model: GridSortModel, details: GridCallbackDetails) => {
    const params = new URLSearchParams(searchParams.toString());

    if (model.length) {
      const { field, sort } = model[0];

      params.set('sortBy', field);

      if (sort) {
        params.set('sortOrder', sort);
      }
    } else {
      params.delete('sortBy');
      params.delete('sortOrder');
    }

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    dataGridProps.onSortModelChange?.(model, details);
  };

  return (
    <List
      createButtonProps={{ variant: 'outlined' }}
      wrapperProps={{
        sx: {
          backgroundColor: 'background.default',
        },
      }}
      headerButtons={headerButtons}
      breadcrumb={<AppBreadcrumb />}
    >
      {isMounted ? (
        <DataGrid
          {...dataGridProps}
          onPaginationModelChange={handlePaginationModelChange}
          onSortModelChange={handleSortModelChange}
          columns={columns}
        />
      ) : (
        <LinearProgress />
      )}
    </List>
  );
};
