'use client';

import { RecordView, StringEntityField } from '@/common/components';
import { useResourceShow } from '@/common/hooks';
import { DownloadButton } from '@/features/file/components';
import { getFileSize } from '@/features/file/helpers';
import { OpenInBrowserOutlined } from '@mui/icons-material';
import Button from '@mui/material/Button';
import { GrpcFile, GrpcFileUploadStatus } from '@packages/grpc';
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
          {record?.id && record.uploadStatus === GrpcFileUploadStatus.READY && (
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
        <StringEntityField label="Original name" value={record?.originalName} />
        <StringEntityField label="Size" value={getFileSize(record?.size)} />
        <StringEntityField label="Mime type" value={record?.mimeType} />
        <StringEntityField label="Extension" value={record?.extension} />
        <StringEntityField label="Upload status" value={record?.uploadStatus} />
      </RecordView>
    </Show>
  );
}
