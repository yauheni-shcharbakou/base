'use client';

import {
  formatDateTime,
  formatFileSize,
  getFileUploadStatusColor,
  getStorageItemKind,
  STORAGE_ITEM_KIND_LABELS,
} from '@/features/storage/helpers';
import { getVideoDuration } from '@/features/video/helpers';
import { Chip, Divider, Paper, Stack, Typography } from '@mui/material';
import type { BrowserStorage } from '@packages/proto';
import React, { FC, ReactNode } from 'react';
import { StorageItemIcon } from './storage-item-icon';

type Props = {
  item: BrowserStorage.StorageObjectFolderItem;
};

const InfoRow: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <Stack direction="row" justifyContent="space-between" gap={2}>
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="body2" component="div" textAlign="right" sx={{ wordBreak: 'break-all' }}>
      {children}
    </Typography>
  </Stack>
);

/**
 * The selected item's details, laid over the right of the stage — Finder's preview pane, hidden
 * until asked for. Its actions are the stage bar's, not repeated here.
 */
export const GalleryInfo: FC<Props> = ({ item }) => {
  const kind = getStorageItemKind(item);
  const status = item.file?.uploadStatus;

  return (
    <Paper
      variant="outlined"
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      sx={{
        position: 'absolute',
        top: 56,
        right: 12,
        bottom: 12,
        width: { xs: 'calc(100% - 24px)', sm: 320 },
        maxHeight: 'calc(100% - 68px)',
        height: 'fit-content',
        overflowY: 'auto',
        p: 2,
        borderRadius: 2,
        bgcolor: (theme) =>
          theme.palette.mode === 'dark' ? 'rgba(33, 33, 33, 0.85)' : 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        zIndex: 2,
      }}
    >
      <Stack gap={1.5}>
        <Stack direction="row" gap={1} alignItems="flex-start">
          <StorageItemIcon kind={kind} sx={{ mt: 0.25 }} />
          <Typography variant="subtitle1" fontWeight={600} sx={{ wordBreak: 'break-word' }}>
            {item.name}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {STORAGE_ITEM_KIND_LABELS[kind]}
          {item.file ? ` · ${formatFileSize(item.file.size)}` : ''}
          {item.folderStats ? ` · ${formatFileSize(item.folderStats.totalSize)}` : ''}
        </Typography>

        <Divider />

        <InfoRow label="Created">{formatDateTime(item.createdAt)}</InfoRow>
        <InfoRow label="Modified">{formatDateTime(item.updatedAt ?? item.createdAt)}</InfoRow>
        {item.image && (
          <InfoRow label="Dimensions">
            {item.image.width} × {item.image.height}
          </InfoRow>
        )}
        {item.video && <InfoRow label="Duration">{getVideoDuration(item.video.duration)}</InfoRow>}
        {/* A folder's whole subtree: subfolders at any depth, files once their upload is READY. */}
        {item.folderStats && (
          <>
            <InfoRow label="Files">{item.folderStats.fileCount}</InfoRow>
            <InfoRow label="Folders">{item.folderStats.folderCount}</InfoRow>
          </>
        )}
        {item.file?.mimeType && <InfoRow label="MIME type">{item.file.mimeType}</InfoRow>}
        <InfoRow label="Public">{item.isPublic ? 'Yes' : 'No'}</InfoRow>
        {!item.isFolder && (
          <InfoRow label="Status">
            <Chip
              size="small"
              label={status ?? 'NO FILE'}
              color={getFileUploadStatusColor(status) ?? 'default'}
            />
          </InfoRow>
        )}
      </Stack>
    </Paper>
  );
};
