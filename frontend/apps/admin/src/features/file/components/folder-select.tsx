'use client';

import { ControlledSingleSelect } from '@/common/components';
import { getUserFolders } from '@/features/file/actions';
import { GrpcStorageObjectPopulated } from '@packages/grpc';
import React, { FC, useEffect, useState } from 'react';
import { FieldErrors, UseFormReturn } from 'react-hook-form';

type Props = Pick<UseFormReturn<any>, 'control'> & {
  errors?: FieldErrors<any>;
  label: string;
  formField: string;
  userId?: string;
  required?: boolean;
};

export const FolderSelect: FC<Props> = ({ userId, errors, ...props }: Props) => {
  const [folders, setFolders] = useState<GrpcStorageObjectPopulated[]>([]);

  useEffect(() => {
    if (userId) {
      getUserFolders(userId)
        .then((response) => setFolders(() => response))
        .catch(console.error);
    }
  }, [userId]);

  return (
    <ControlledSingleSelect
      {...props}
      fieldError={errors?.[props.formField]}
      options={folders.map((folder) => ({ label: folder.folderPath!, value: folder.id }))}
    />
  );
};
