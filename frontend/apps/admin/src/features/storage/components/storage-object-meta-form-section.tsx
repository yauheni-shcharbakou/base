'use client';

import { ControlledBooleanField, ControlledTextField } from '@/common/components';
import { FieldErr } from '@/common/types';
import { FolderSelect } from '@/features/storage/components/folder-select';
import { Card, CardContent, CardHeader } from '@mui/material';
import React from 'react';
import { Control, FieldErrors } from 'react-hook-form';

type StorageMeta =
  | {
      parent?: string;
      isPublic?: boolean;
      name?: string;
    }
  | {
      parent?: string;
      isPublic?: boolean;
    };

type Props<Values extends StorageMeta = StorageMeta> = {
  control?: Control<Values, any, Values>;
  errors?: FieldErrors<Values>;
  parent?: string;
  excludeName?: boolean;
};

export const StorageObjectMetaFormSection = <Values extends StorageMeta = StorageMeta>({
  control,
  errors,
  parent,
  excludeName,
}: Props<Values>) => {
  return (
    <Card variant="outlined">
      <CardHeader title="Storage" />
      <CardContent>
        <FolderSelect
          label="Folder"
          fieldName="parent"
          fieldErr={errors?.parent as FieldErr}
          control={control}
        />
        {parent && (
          <>
            {!excludeName && (
              <ControlledTextField
                control={control as Control}
                fieldName="name"
                fieldErr={(errors as { name?: FieldErr })?.name}
                label="Name"
              />
            )}
            <ControlledBooleanField control={control} fieldName="isPublic" label="Public" />
          </>
        )}
      </CardContent>
    </Card>
  );
};
