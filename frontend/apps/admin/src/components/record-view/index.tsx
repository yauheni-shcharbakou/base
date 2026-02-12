'use client';

import { DateEntityField, StringEntityField } from '@/components/entity-fields';
import { Divider, Stack } from '@mui/material';
import { GrpcEntityWithTimestamps } from '@packages/grpc';
import React, { FC, ReactNode } from 'react';

type Props = {
  record?: GrpcEntityWithTimestamps;
  children?: ReactNode;
};

export const RecordView: FC<Props> = ({ record, children }: Props) => {
  return (
    <Stack gap={1}>
      <StringEntityField label="ID" value={record?.id} />
      <Divider />
      {children}
      <Divider />
      <DateEntityField label="Created at" value={record?.createdAt} />
      <DateEntityField label="Updated at" value={record?.updatedAt} />
    </Stack>
  );
};
