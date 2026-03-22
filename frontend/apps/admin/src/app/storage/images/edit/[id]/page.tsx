'use client';

import { TextEditField } from '@/common/components';
import { useValidatedForm } from '@/common/hooks';
import { Box } from '@mui/material';
import { Edit } from '@refinedev/mui';
import React from 'react';
import zod from 'zod';

export default function ImageEdit() {
  const {
    saveButtonProps,
    formState: { errors },
    refineCore: { formLoading, query },
    register,
  } = useValidatedForm({
    alt: zod.string().optional(),
  });

  const entity = query?.data?.data;

  return (
    <Edit
      isLoading={formLoading && !!entity}
      saveButtonProps={{
        ...saveButtonProps,
        disabled: formLoading || !entity,
      }}
    >
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column' }} autoComplete="off">
        <TextEditField
          register={register('alt', { setValueAs: (value) => value || undefined })}
          label="Alt"
          value={entity?.alt}
          fieldError={errors?.alt}
        />
      </Box>
    </Edit>
  );
}
