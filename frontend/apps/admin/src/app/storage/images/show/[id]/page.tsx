'use client';

import { RecordView, StringEntityField } from '@/common/components';
import { useResourceShow } from '@/common/hooks';
import { DownloadButton } from '@/features/file/components';
import { OpenInBrowserOutlined } from '@mui/icons-material';
import Button from '@mui/material/Button';
import { StorageDatabaseEntity } from '@packages/common';
import { GrpcFile, GrpcImage } from '@packages/grpc';
import { useOne } from '@refinedev/core';
import { Show } from '@refinedev/mui';
import React from 'react';

export default function ImageShow() {
  const { isLoading, record } = useResourceShow<GrpcImage>();
  const openLink = `/api/files/${record?.file}/open`;

  const { query } = useOne<GrpcFile>({ resource: StorageDatabaseEntity.FILE, id: record?.file });

  const file = query?.data?.data;

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
            </>
          )}
          {file && (
            <DownloadButton
              variant="text"
              url={openLink}
              fileName={`${file.id}.${file.extension}`}
            />
          )}
          {defaultButtons}
        </>
      )}
    >
      <RecordView record={record}>
        <StringEntityField label="User" value={record?.user} />
        <StringEntityField label="File" value={record?.file} />
        <StringEntityField label="Alt" value={record?.alt} />
        <StringEntityField label="Width" value={record?.width?.toString()} />
        <StringEntityField label="Height" value={record?.height?.toString()} />
      </RecordView>
    </Show>
  );
}
