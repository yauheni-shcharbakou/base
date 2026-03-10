'use client';

import { RecordView, RefButtonContainer, StringEntityField } from '@/common/components';
import { useResourceShow } from '@/common/hooks';
import { DownloadButton } from '@/features/file/components';
import { getFileSize } from '@/features/file/helpers';
import { ImagePreview } from '@/features/image/components';
import { OpenInBrowserOutlined, ExpandMore } from '@mui/icons-material';
import { Accordion, AccordionDetails, AccordionSummary, Typography } from '@mui/material';
import Button from '@mui/material/Button';
import { AuthDatabaseEntity, Database, StorageDatabaseEntity } from '@packages/common';
import { GrpcFileUploadStatus, GrpcImagePopulated } from '@packages/grpc';
import { Show } from '@refinedev/mui';
import React from 'react';

export default function ImageShow() {
  const { isLoading, record } = useResourceShow<GrpcImagePopulated>();
  const isFileReady = record?.file?.uploadStatus === GrpcFileUploadStatus.READY;

  return (
    <Show
      isLoading={isLoading || !record?.id}
      headerButtons={({ defaultButtons }) => (
        <>
          {isFileReady && (
            <>
              <Button
                variant="text"
                startIcon={<OpenInBrowserOutlined />}
                component="a"
                target="_blank"
                href={`/api/files/${record?.fileId}/open`}
              >
                Open
              </Button>
              <DownloadButton
                variant="text"
                resource={StorageDatabaseEntity.FILE}
                id={record.fileId}
              />
            </>
          )}
          {defaultButtons}
        </>
      )}
    >
      {isFileReady && (
        <Accordion defaultExpanded>
          <AccordionSummary
            expandIcon={<ExpandMore />}
            aria-controls="preview-content"
            id="preview"
          >
            <Typography component="span">Preview</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <ImagePreview image={record} />
          </AccordionDetails>
        </Accordion>
      )}

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />} aria-controls="refs-content" id="refs">
          <Typography component="span">References</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <RefButtonContainer
            refs={[
              {
                database: Database.AUTH,
                resource: AuthDatabaseEntity.USER,
                id: record?.userId,
                label: 'User',
              },
              {
                database: Database.STORAGE,
                resource: StorageDatabaseEntity.FILE,
                id: record?.fileId,
                label: 'File',
              },
            ]}
          />
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMore />} aria-controls="info-content" id="info">
          <Typography component="span">Image info</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <RecordView record={record}>
            <StringEntityField label="Alt" value={record?.alt} />
            <StringEntityField label="Width" value={record?.width?.toString()} />
            <StringEntityField label="Height" value={record?.height?.toString()} />
            <StringEntityField label="Size" value={getFileSize(record?.file?.size)} />
          </RecordView>
        </AccordionDetails>
      </Accordion>
    </Show>
  );
}
