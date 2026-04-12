'use client';

import { ControlledSingleSelect, SelectOption } from '@/common/components';
import { folderActionClient } from '@/features/storage/clients';
import React, { useEffect, useState } from 'react';
import { FieldErrors, FieldValues, UseFormReturn } from 'react-hook-form';

type Props<V extends FieldValues = FieldValues, E = any, T = V> = Pick<
  UseFormReturn<V, E, T>,
  'control'
> & {
  errors?: FieldErrors<any>;
  label: string;
  formField: string;
  required?: boolean;
  defaultValue?: string;
  onOptionsLoaded?: (options?: SelectOption[]) => void;
  id?: string;
};

export const FolderSelect = <V extends FieldValues, E = any, T = V>({
  errors,
  onOptionsLoaded,
  id,
  ...props
}: Props<V, E, T>) => {
  const [options, setOptions] = useState<SelectOption[]>([]);

  useEffect(() => {
    folderActionClient
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

  return (
    <ControlledSingleSelect {...props} fieldError={errors?.[props.formField]} options={options} />
  );
};
