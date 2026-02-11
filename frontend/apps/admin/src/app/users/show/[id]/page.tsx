'use client';

import { TimestampFields } from '@/components/timestamp-fields';
import { Stack, Typography } from '@mui/material';
import { GrpcUser } from '@packages/grpc';
import { useShow } from '@refinedev/core';
import { Show, TextFieldComponent } from '@refinedev/mui';

export default function UserShow() {
  const { query } = useShow<GrpcUser>();
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
          Email
        </Typography>
        <TextFieldComponent value={record?.email} />
        <Typography variant="body1" fontWeight="bold" color="info">
          Role
        </Typography>
        <TextFieldComponent value={record?.role} />
        <TimestampFields record={record} />
      </Stack>
    </Show>
  );
}
