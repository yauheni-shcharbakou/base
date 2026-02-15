'use client';

import { BaseRecord, type HttpError } from '@refinedev/core';
import { useDataGrid, UseDataGridProps, UseDataGridReturnType } from '@refinedev/mui';
import _ from 'lodash';
import { useEffect, useState } from 'react';

export const useResourceList = <
  TQueryFnData extends BaseRecord = BaseRecord,
  TError extends HttpError = HttpError,
  TSearchVariables = unknown,
  TData extends BaseRecord = TQueryFnData,
>(
  props: UseDataGridProps<TQueryFnData, TError, TSearchVariables, TData> = {},
): UseDataGridReturnType<TData, TError, TSearchVariables> & { isMounted: boolean } => {
  const [isMounted, setIsMounted] = useState(false);

  const grid = useDataGrid<TQueryFnData, TError, TSearchVariables, TData>({
    queryOptions: {
      enabled: isMounted,
      retry: 3,
      retryDelay: 1_000,
      ...(props.queryOptions ?? {}),
    },
    ..._.omit(props, ['queryOptions']),
  });

  useEffect(() => {
    setIsMounted(() => true);
    grid.setSorters([{ field: 'id', order: 'desc' }]);
    grid.setCurrentPage(1);
  }, []);

  return { ...grid, isMounted };
};
