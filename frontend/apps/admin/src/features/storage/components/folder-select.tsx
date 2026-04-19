'use client';

import {
  ControlledSingleSelect,
  ControlledSingleSelectProps,
  SelectOption,
} from '@/common/components';
import { folderActionProvider } from '@/features/storage/providers';
import React, { useEffect, useState } from 'react';
import { FieldValues } from 'react-hook-form';

type Props<V extends FieldValues = FieldValues, E = any, T = V> = Omit<
  ControlledSingleSelectProps<V, E, T>,
  'defaultValue' | 'options'
> & {
  defaultValue?: string;
  onOptionsLoaded?: (options?: SelectOption[]) => void;
  id?: string;
};

export const FolderSelect = <V extends FieldValues = FieldValues, E = any, T = V>({
  onOptionsLoaded,
  id,
  ...props
}: Props<V, E, T>) => {
  const [options, setOptions] = useState<SelectOption[]>([]);

  useEffect(() => {
    folderActionProvider
      .getUserFolders(id)
      .then((response) => {
        setOptions(() => {
          return response.map((folder) => ({ label: folder.folderPath, value: folder.id }));
        });
      })
      .catch(console.error);
  }, []);

  if (onOptionsLoaded) {
    useEffect(() => {
      if (options.length) {
        onOptionsLoaded(options);
      }
    }, [options]);
  }

  return <ControlledSingleSelect {...props} options={options} />;
};
