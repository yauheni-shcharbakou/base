'use client';

import {
  BooleanEntityField,
  RecordView,
  RefButtonContainer,
  RefButtonContainerProps,
  StringEntityField,
} from '@/common/components';
import { useResourceShow } from '@/common/hooks';
import { DownloadButton } from '@/features/file/components';
import { getFileSize, getFileUploadStatusColor } from '@/features/file/helpers';
import { ImagePreview } from '@/features/image/components';
import { VideoPlayer } from '@/features/video/components';
import { getVideoDuration } from '@/features/video/helpers';
import { ExpandMore, OpenInBrowserOutlined } from '@mui/icons-material';
import { Accordion, AccordionDetails, AccordionSummary, Typography } from '@mui/material';
import Button from '@mui/material/Button';
import { AuthDatabaseEntity, Database, StorageDatabaseEntity } from '@packages/common';
import {
  GrpcFileUploadStatus,
  GrpcStorageObjectPopulated,
  GrpcStorageObjectType,
} from '@packages/grpc';
import { Show } from '@refinedev/mui';
import React, { useMemo } from 'react';

export default function StorageObjectShow() {
  const { isLoading, record } = useResourceShow<GrpcStorageObjectPopulated>();
  const isFileReady = record?.file?.uploadStatus === GrpcFileUploadStatus.READY;
  const isVideo = record?.type === GrpcStorageObjectType.VIDEO;

  const refs: RefButtonContainerProps['refs'] = useMemo(() => {
    const items: RefButtonContainerProps['refs'] = [
      {
        database: Database.AUTH,
        resource: AuthDatabaseEntity.USER,
        id: record?.userId,
        label: 'User',
      },
    ];

    if (record?.fileId) {
      items.push({
        database: Database.STORAGE,
        resource: StorageDatabaseEntity.FILE,
        id: record.fileId,
        label: 'File',
      });
    }

    if (record?.imageId) {
      items.push({
        database: Database.STORAGE,
        resource: StorageDatabaseEntity.IMAGE,
        id: record.imageId,
        label: 'Image',
      });
    }

    if (record?.videoId) {
      items.push({
        database: Database.STORAGE,
        resource: StorageDatabaseEntity.VIDEO,
        id: record.videoId,
        label: 'Video',
      });
    }

    return items;
  }, [record?.userId, record?.fileId, record?.imageId, record?.videoId]);

  return (
    <Show
      isLoading={isLoading || !record?.id}
      headerButtons={({ defaultButtons }) => {
        if (!isFileReady) {
          return <>{defaultButtons}</>;
        }

        if (isVideo) {
          return (
            <>
              <Button
                variant="text"
                startIcon={<OpenInBrowserOutlined />}
                component="a"
                target="_blank"
                href={`/api/${StorageDatabaseEntity.VIDEO}/${record?.videoId}/player`}
              >
                Open
              </Button>
              {record.videoId && (
                <DownloadButton
                  variant="text"
                  resource={StorageDatabaseEntity.VIDEO}
                  id={record.videoId}
                />
              )}
              {defaultButtons}
            </>
          );
        }

        return (
          <>
            <Button
              variant="text"
              startIcon={<OpenInBrowserOutlined />}
              component="a"
              target="_blank"
              href={`/api/${StorageDatabaseEntity.FILE}/${record?.fileId}/open`}
            >
              Open
            </Button>
            {record.fileId && (
              <DownloadButton
                variant="text"
                resource={StorageDatabaseEntity.FILE}
                id={record.fileId}
              />
            )}
            {defaultButtons}
          </>
        );
      }}
    >
      {isFileReady && record?.image && (
        <Accordion>
          <AccordionSummary
            expandIcon={<ExpandMore />}
            aria-controls="image-preview-content"
            id="image-preview"
          >
            <Typography component="span">Preview</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <ImagePreview image={record.image} />
          </AccordionDetails>
        </Accordion>
      )}

      {isFileReady && record?.videoId && (
        <Accordion>
          <AccordionSummary
            expandIcon={<ExpandMore />}
            aria-controls="video-preview-content"
            id="video-preview"
          >
            <Typography component="span">Preview</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <VideoPlayer videoId={record.videoId} />
          </AccordionDetails>
        </Accordion>
      )}

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />} aria-controls="refs-content" id="refs">
          <Typography component="span">References</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <RefButtonContainer refs={refs} />
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded>
        <AccordionSummary
          expandIcon={<ExpandMore />}
          aria-controls="storage-object-content"
          id="storage-object"
        >
          <Typography component="span">Storage object info</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <RecordView record={record}>
            <StringEntityField label="Name" value={record?.name || 'Root folder'} />
            <BooleanEntityField label="Public" value={record?.isPublic} />
            <StringEntityField label="Type" value={record?.type} />
            {record?.folderPath && (
              <StringEntityField label="Folder path" value={record.folderPath} />
            )}
          </RecordView>
        </AccordionDetails>
      </Accordion>

      {record?.file && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMore />} aria-controls="file-content" id="file">
            <Typography component="span">File info</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <RecordView record={record.file}>
              <StringEntityField label="Original name" value={record.file.originalName} />
              <StringEntityField label="Size" value={getFileSize(record.file.size)} />
              <StringEntityField label="Mime type" value={record.file.mimeType} />
              <StringEntityField label="Extension" value={record.file.extension} />
              <StringEntityField
                label="Upload status"
                value={record.file.uploadStatus}
                color={getFileUploadStatusColor(record.file.uploadStatus)}
              />
            </RecordView>
          </AccordionDetails>
        </Accordion>
      )}

      {record?.image && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMore />} aria-controls="image-content" id="image">
            <Typography component="span">Image info</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <RecordView record={record.image}>
              <StringEntityField label="Alt" value={record.image.alt} />
              <StringEntityField label="Width" value={record.image.width.toString()} />
              <StringEntityField label="Height" value={record.image.height.toString()} />
            </RecordView>
          </AccordionDetails>
        </Accordion>
      )}

      {record?.video && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMore />} aria-controls="video-content" id="video">
            <Typography component="span">Video info</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <RecordView record={record.video}>
              <StringEntityField label="Title" value={record.video.title} />
              {record.video.description && (
                <StringEntityField label="Description" value={record.video.description} />
              )}
              <StringEntityField label="Duration" value={getVideoDuration(record.video.duration)} />
              <StringEntityField label="Views" value={record.video.views.toString()} />
            </RecordView>
          </AccordionDetails>
        </Accordion>
      )}
    </Show>
  );
}
