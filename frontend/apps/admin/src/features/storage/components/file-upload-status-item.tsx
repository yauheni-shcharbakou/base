'use client';

import { getFileSize } from '@/features/storage/helpers';
import { FileUploadItem } from '@/features/storage/hooks';
import { CheckCircle, Replay } from '@mui/icons-material';
import { Box, IconButton, LinearProgress, ListItem, Stack, Typography } from '@mui/material';
import React, { FC } from 'react';

type Props = {
  uploadItem: FileUploadItem;
  onRetry?: (uploadItem: FileUploadItem) => Promise<void>;
  frozen?: boolean;
};

const FileUploadStatusItemComponent: FC<Props> = ({ uploadItem, onRetry, frozen }: Props) => {
  return (
    <ListItem
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        mb: 1,
        flexDirection: 'column',
        alignItems: 'stretch',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={2}>
        <Typography variant="body2" sx={{ flexGrow: 1 }}>
          {uploadItem.file.name} ({getFileSize(uploadItem.file.size)})
        </Typography>

        {uploadItem.status === 'success' && <CheckCircle color="success" fontSize="small" />}

        {uploadItem.status === 'error' && !!uploadItem.entityId && (
          <IconButton
            size="small"
            onClick={() => onRetry?.(uploadItem)}
            color="warning"
            disabled={frozen}
          >
            <Replay fontSize="small" />
          </IconButton>
        )}
      </Stack>

      {uploadItem.status === 'in-process' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
          {uploadItem.progress >= 100 ? (
            <LinearProgress variant="indeterminate" color="primary" sx={{ flexGrow: 1 }} />
          ) : (
            <LinearProgress
              variant="determinate"
              value={uploadItem.progress}
              sx={{ flexGrow: 1 }}
              color="primary"
            />
          )}
          <Typography variant="caption" sx={{ minWidth: 35 }}>
            {uploadItem.progress.toFixed(2)} %
          </Typography>
        </Box>
      )}
    </ListItem>
  );
};

export const FileUploadStatusItem = React.memo(FileUploadStatusItemComponent, (prev, next) => {
  return (
    prev.uploadItem.status === next.uploadItem.status &&
    prev.uploadItem.progress === next.uploadItem.progress &&
    prev.uploadItem.entityId === next.uploadItem.entityId &&
    prev.frozen === next.frozen &&
    prev.onRetry === next.onRetry
  );
});
