'use client';

import { AppEdit, TextEditField } from '@/common/components';
import { useValidatedForm } from '@/common/hooks';
import { Box } from '@mui/material';
import React from 'react';
import zod from 'zod';

export default function ImageEdit() {
  const {
    saveButtonProps,
    formState: { errors },
    refineCore: { formLoading },
    register,
    providerData,
  } = useValidatedForm({
    alt: zod.string().optional(),
  });

  return (
    <AppEdit
      isLoading={formLoading && !!providerData}
      saveButtonProps={{
        ...saveButtonProps,
        disabled: formLoading || !providerData,
      }}
    >
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column' }} autoComplete="off">
        <TextEditField
          register={register('alt', { setValueAs: (value) => value || undefined })}
          label="Alt"
          value={providerData?.alt}
          fieldErr={errors?.alt}
        />
      </Box>
    </AppEdit>
  );
}
