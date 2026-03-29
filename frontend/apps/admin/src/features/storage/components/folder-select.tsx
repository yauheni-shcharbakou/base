'use client';

import { ControlledSingleSelect } from '@/common/components';
import { folderActionClient } from '@/features/storage/clients';
import { GrpcStorageObjectPopulated } from '@packages/grpc';
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
};

export const FolderSelect = <V extends FieldValues, E = any, T = V>({
  errors,
  ...props
}: Props<V, E, T>) => {
  const [folders, setFolders] = useState<GrpcStorageObjectPopulated[]>([]);

  useEffect(() => {
    folderActionClient
      .getUserFolders()
      .then((response) => setFolders(() => response))
      .catch(console.error);
  }, []);

  return (
    <ControlledSingleSelect
      {...props}
      fieldError={errors?.[props.formField]}
      options={folders.map((folder) => ({ label: folder.folderPath!, value: folder.id }))}
    />
  );
};
