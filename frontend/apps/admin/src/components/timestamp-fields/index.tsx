'use client';

import { Divider, Stack, Typography } from '@mui/material';
import { GrpcEntityWithTimestamps } from '@packages/grpc';
import { DateField } from '@refinedev/mui';
import React, { FC } from 'react';

type Props = {
  record?: GrpcEntityWithTimestamps;
};

export const TimestampFields: FC<Props> = ({ record }: Props) => {
  return (
    <>
      <Divider />
      <Stack gap={1}>
        <Typography variant="body1" fontWeight="bold" color="info">
          Created at
        </Typography>
        <DateField value={record?.createdAt} format="YYYY-MM-DDThh:mm:ssZ" />
        <Typography variant="body1" fontWeight="bold" color="info">
          Updated at
        </Typography>
        <DateField value={record?.updatedAt} format="YYYY-MM-DDThh:mm:ssZ" />
      </Stack>
    </>
  );
};
