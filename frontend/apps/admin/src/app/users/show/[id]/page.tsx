'use client';

import { Stack, Typography } from '@mui/material';
import { User } from '@packages/grpc';
import { useShow } from '@refinedev/core';
import { Show, TextFieldComponent as TextField } from '@refinedev/mui';

export default function UserShow() {
  const { query } = useShow<User>();
  const { data, isLoading } = query;
  const record = data?.data;

  return (
    <Show isLoading={isLoading}>
      <Stack gap={1}>
        <Typography variant="body1" fontWeight="bold">
          {'ID'}
        </Typography>
        <TextField value={record?.id} />
        <Typography variant="body1" fontWeight="bold">
          {'Email'}
        </Typography>
        <TextField value={record?.email} />
        <Typography variant="body1" fontWeight="bold">
          {'Role'}
        </Typography>
        <TextField value={record?.role} />
      </Stack>
    </Show>
  );
}
