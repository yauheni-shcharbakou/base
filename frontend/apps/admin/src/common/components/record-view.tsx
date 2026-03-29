'use client';

import { DateEntityField } from '@/common/components/entity-fields';
import { IdField } from '@/common/components/id-field';
import { Divider, Skeleton, Stack, Typography } from '@mui/material';
import { GrpcEntityWithTimestamps } from '@packages/grpc';
import React, { FC, ReactNode } from 'react';

type Props = {
  record?: GrpcEntityWithTimestamps;
  children?: ReactNode;
};

export const RecordView: FC<Props> = ({ record, children }: Props) => {
  if (!record) {
    return <Skeleton variant="rectangular" height={200} animation="wave" />;
  }

  return (
    <Stack gap={1}>
      <Typography variant="body1" fontWeight="bold" color="info">
        ID
      </Typography>
      <IdField value={record?.id} />
      <Divider />
      {children}
      <Divider />
      <DateEntityField label="Created at" value={record?.createdAt} />
      <DateEntityField label="Updated at" value={record?.updatedAt} />
    </Stack>
  );
};
