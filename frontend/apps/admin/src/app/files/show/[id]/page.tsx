'use client';

import { BooleanEntityField, StringEntityField } from '@/components/entity-fields';
import { RecordView } from '@/components/record-view';
import { getFileSize } from '@/helpers/file.helpers';
import { useResourceShow } from '@/hooks/use-resource-show';
import { GrpcFile } from '@packages/grpc';
import { Show } from '@refinedev/mui';
import React from 'react';

export default function FileShow() {
  const { isLoading, record } = useResourceShow<GrpcFile>();

  return (
    <Show isLoading={isLoading}>
      <RecordView record={record}>
        <StringEntityField label="Name" value={record?.name} />
        <StringEntityField label="Original name" value={record?.originalName} />
        <StringEntityField label="Size" value={getFileSize(record?.size)} />
        <BooleanEntityField label="Public" value={record?.isPublic} />
        <StringEntityField label="Type" value={record?.type} />
        <StringEntityField label="Mime type" value={record?.mimeType} />
        <StringEntityField label="Extension" value={record?.extension} />
      </RecordView>
    </Show>
  );
}
