'use client';

import {
  ControlledSingleSelect,
  ControlledSingleSelectProps,
  SelectOption,
} from '@/common/components';
import { AuthDatabaseEntity } from '@packages/common';
import { BrowserAuth } from '@packages/proto';
import { useList } from '@refinedev/core';
import { useEffect, useState } from 'react';
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

  const { result } = useList<BrowserAuth.User>({
    resource: AuthDatabaseEntity.USER,
    pagination: { pageSize: 100, currentPage: 1 },
  });

  useEffect(() => {
    setOptions(() => {
      return (result.data ?? []).map((user) => ({ label: user.email, value: user.id }));
    });

    if (onOptionsLoaded && options.length) {
      onOptionsLoaded(options);
    }
  }, [result.data]);

  return <ControlledSingleSelect {...props} options={options} />;
};
