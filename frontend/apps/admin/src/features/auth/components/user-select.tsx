'use client';

import {
  ControlledSingleSelect,
  ControlledSingleSelectProps,
  SelectOption,
} from '@/common/components';
import { AuthDatabaseEntity } from '@packages/common';
import { BrowserAuth } from '@packages/proto';
import { useList } from '@refinedev/core';
import { useEffect, useRef, useState } from 'react';
import { FieldValues } from 'react-hook-form';

type Props<V extends FieldValues = FieldValues, E = any, T = V> = Omit<
  ControlledSingleSelectProps<V, E, T>,
  'defaultValue' | 'options'
> & {
  defaultValue?: string;
  onOptionsLoaded?: (options?: SelectOption[]) => void;
};

export const UserSelect = <V extends FieldValues = FieldValues, E = any, T = V>({
  onOptionsLoaded,
  ...props
}: Props<V, E, T>) => {
  const [options, setOptions] = useState<SelectOption[]>([]);

  // Keep the latest callback in a ref so the effect doesn't depend on it.
  const onOptionsLoadedRef = useRef(onOptionsLoaded);

  useEffect(() => {
    onOptionsLoadedRef.current = onOptionsLoaded;
  });

  const { result } = useList<BrowserAuth.User>({
    resource: AuthDatabaseEntity.USER,
    pagination: { pageSize: 100, currentPage: 1 },
  });

  useEffect(() => {
    const next = (result.data ?? []).map((user) => ({ label: user.email, value: user.id }));

    setOptions(next);

    if (next.length) {
      onOptionsLoadedRef.current?.(next);
    }
  }, [result.data]);

  return <ControlledSingleSelect {...props} options={options} />;
};
