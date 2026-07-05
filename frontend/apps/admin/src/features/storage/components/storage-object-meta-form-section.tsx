'use client';

import { ControlledBooleanField, ControlledTextField } from '@/common/components';
import { FieldErr } from '@/common/types';
import { FolderSelect } from '@/features/storage/components/folder-select';
import { Card, CardContent, CardHeader } from '@mui/material';
import { Control, FieldErrors } from 'react-hook-form';

type StorageMeta =
  | {
      userId?: string;
      parent?: string;
      isPublic?: boolean;
      name?: string;
    }
  | {
      userId?: string;
      parent?: string;
      isPublic?: boolean;
    };

type Props<Values extends StorageMeta = StorageMeta> = {
  control?: Control<Values, any, Values>;
  errors?: FieldErrors<Values>;
  parent?: string;
  excludeName?: boolean;
  userId?: string;
};

export const StorageObjectMetaFormSection = <Values extends StorageMeta = StorageMeta>({
  control,
  errors,
  parent,
  excludeName,
  userId,
}: Props<Values>) => {
  return (
    <Card variant="outlined">
      <CardHeader title="Storage" />
      <CardContent>
        {userId && (
          <FolderSelect
            label="Folder"
            fieldName="parent"
            fieldErr={errors?.parent as FieldErr}
            control={control}
            userId={userId}
          />
        )}
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
