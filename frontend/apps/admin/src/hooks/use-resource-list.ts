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

  useEffect(() => {
    setIsMounted(() => true);
  }, []);

  return {
    ...useDataGrid<TQueryFnData, TError, TSearchVariables, TData>({
      queryOptions: {
        enabled: isMounted,
        retry: 2,
        retryDelay: 500,
        ...(props.queryOptions ?? {}),
      },
      ..._.omit(props, ['queryOptions']),
    }),
    isMounted,
  };
};
