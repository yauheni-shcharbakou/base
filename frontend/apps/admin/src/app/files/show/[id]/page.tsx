'use client';

import { TimestampFields } from '@/components/timestamp-fields';
import { getFileSize } from '@/helpers/file.helpers';
import { Stack, Typography } from '@mui/material';
import { GrpcFile } from '@packages/grpc';
import { useShow } from '@refinedev/core';
import { BooleanField, Show, TextFieldComponent } from '@refinedev/mui';
import React from 'react';

export default function FileShow() {
  const { query } = useShow<GrpcFile>();
  const { data, isLoading } = query;
  const record = data?.data;

  return (
    <Show isLoading={isLoading}>
      <Stack gap={1}>
        <Typography variant="body1" fontWeight="bold" color="info">
          ID
        </Typography>
        <TextFieldComponent value={record?.id} />
        <Typography variant="body1" fontWeight="bold" color="info">
          Public
        </Typography>
        <BooleanField value={record?.isPublic} />
        <Typography variant="body1" fontWeight="bold" color="info">
          Name
        </Typography>
        <TextFieldComponent value={record?.name} />
        <Typography variant="body1" fontWeight="bold" color="info">
          Original name
        </Typography>
        <TextFieldComponent value={record?.originalName} />
        <Typography variant="body1" fontWeight="bold" color="info">
          Mime type
        </Typography>
        <TextFieldComponent value={record?.mimeType} />
        <Typography variant="body1" fontWeight="bold" color="info">
          Size
        </Typography>
        <TextFieldComponent value={getFileSize(record?.size)} />
        <TimestampFields record={record} />
      </Stack>
    </Show>
  );
}
