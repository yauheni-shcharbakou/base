'use client';

import { DownloadButton } from '@/components/buttons/download';
import { BooleanEntityField, StringEntityField } from '@/components/entity-fields';
import { RecordView } from '@/components/record-view';
import { getFileSize } from '@/helpers/file.helpers';
import { useResourceShow } from '@/hooks/use-resource-show';
import { OpenInBrowserOutlined } from '@mui/icons-material';
import Button from '@mui/material/Button';
import { GrpcFile } from '@packages/grpc';
import { Show } from '@refinedev/mui';
import React from 'react';

export default function FileShow() {
  const { isLoading, record } = useResourceShow<GrpcFile>();
  const openLink = `/api/files/${record?.id}/open`;

  return (
    <Show
      isLoading={isLoading || !record?.id}
      headerButtons={({ defaultButtons }) => (
        <>
          {record?.id && (
            <>
              <Button
                variant="text"
                startIcon={<OpenInBrowserOutlined />}
                component="a"
                target="_blank"
                href={openLink}
              >
                Open
              </Button>
              <DownloadButton
                variant="text"
                url={openLink}
                fileName={`${record.id}.${record.extension}`}
              />
            </>
          )}
          {defaultButtons}
        </>
      )}
    >
      <RecordView record={record}>
        <StringEntityField label="User" value={record?.user} />
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
