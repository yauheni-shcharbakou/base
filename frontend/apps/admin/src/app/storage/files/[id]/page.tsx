'use client';

import { AppShow, RecordView, RefButtonContainer, StringEntityField } from '@/common/components';
import { useResourceShow } from '@/common/hooks';
import { DownloadButton } from '@/features/storage/components';
import { getFileSize, getFileUploadStatusColor } from '@/features/storage/helpers';
import { ExpandMore, OpenInBrowserOutlined } from '@mui/icons-material';
import { Accordion, AccordionDetails, AccordionSummary, Typography } from '@mui/material';
import Button from '@mui/material/Button';
import { AuthDatabaseEntity, Database, StorageDatabaseEntity } from '@packages/common';
import { BrowserStorage } from '@packages/proto';
import React from 'react';

export default function FileShow() {
  const { isLoading, record } = useResourceShow<BrowserStorage.File>();
  const isFileReady = record?.uploadStatus === BrowserStorage.FileUploadStatus.READY;

  return (
    <AppShow
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
                href={`/api/files/${record!.id}/open`}
              >
                Open
              </Button>
              <DownloadButton
                variant="text"
                resource={StorageDatabaseEntity.FILE}
                id={record!.id}
              />
            </>
          )}
          {defaultButtons}
        </>
      )}
    >
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
            <StringEntityField label="Original name" value={record?.originalName} />
            <StringEntityField label="Size" value={getFileSize(record?.size)} />
            <StringEntityField label="Mime type" value={record?.mimeType} />
            <StringEntityField label="Extension" value={record?.extension} />
            <StringEntityField
              label="Upload status"
              value={record?.uploadStatus}
              color={getFileUploadStatusColor(record?.uploadStatus)}
            />
          </RecordView>
        </AccordionDetails>
      </Accordion>
    </AppShow>
  );
}
