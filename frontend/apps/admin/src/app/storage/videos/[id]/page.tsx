'use client';

import { AppShow, RecordView, RefButtonContainer, StringEntityField } from '@/common/components';
import { useResourceShow } from '@/common/hooks';
import { DownloadButton } from '@/features/storage/components';
import { getFileSize } from '@/features/storage/helpers';
import { VideoPlayer } from '@/features/video/components';
import { getVideoDuration } from '@/features/video/helpers';
import { ExpandMore } from '@mui/icons-material';
import { Accordion, AccordionDetails, AccordionSummary, Typography } from '@mui/material';
import { AuthDatabaseEntity, Database, StorageDatabaseEntity } from '@packages/common';
import { BrowserStorage } from '@packages/proto';
import React from 'react';

export default function VideoShow() {
  const { isLoading, record } = useResourceShow<BrowserStorage.VideoPopulated>();
  const isFileReady = record?.file?.uploadStatus === BrowserStorage.FileUploadStatus.READY;

  return (
    <AppShow
      isLoading={isLoading || !record?.id}
      headerButtons={({ defaultButtons }) => (
        <>
          {isFileReady && (
            <DownloadButton variant="text" resource={StorageDatabaseEntity.VIDEO} id={record?.id} />
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
            <VideoPlayer videoId={record?.id} />
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
            <StringEntityField label="Title" value={record?.title} />
            {record?.description && (
              <StringEntityField label="Description" value={record?.description} />
            )}
            <StringEntityField label="Duration" value={getVideoDuration(record?.duration || 0)} />
            <StringEntityField label="Views" value={record?.views?.toString()} />
            <StringEntityField label="Size" value={getFileSize(record?.file?.size)} />
          </RecordView>
        </AccordionDetails>
      </Accordion>
    </AppShow>
  );
}
