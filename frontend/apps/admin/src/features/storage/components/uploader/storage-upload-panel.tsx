'use client';

import { pathProvider } from '@/common/providers';
import { getStorageItemKind, QueuedUpload, summarizeUploads } from '@/features/storage/helpers';
import {
  FOLDER_CONTENT_QUERY_KEY,
  storageUploadQueue,
  useStorageUploads,
} from '@/features/storage/hooks';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import ExpandLessRounded from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import ReplayRounded from '@mui/icons-material/ReplayRounded';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  LinearProgress,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { Database, StorageDatabaseEntity } from '@packages/common';
import { useInvalidate } from '@refinedev/core';
import { useQueryClient } from '@tanstack/react-query';
import NextLink from 'next/link';
import React, { FC, useEffect, useRef, useState } from 'react';
import { StorageItemIcon } from '../folder-browser/storage-item-icon';

const { STORAGE } = Database;
const { FILE, IMAGE, STORAGE_OBJECT, VIDEO } = StorageDatabaseEntity;

// Finished uploads reach the listings in one refresh, not one per file.
const REFRESH_DELAY_MS = 500;

const getTitle = ({ total, done, failed, active }: ReturnType<typeof summarizeUploads>) => {
  if (active) {
    return `Uploading ${active} ${active === 1 ? 'item' : 'items'}`;
  }

  if (failed) {
    return `${failed} of ${total} ${total === 1 ? 'upload' : 'uploads'} failed`;
  }

  return `${done} ${done === 1 ? 'upload' : 'uploads'} complete`;
};

const UploadState: FC<{ item: QueuedUpload }> = ({ item }) => {
  switch (item.status) {
    case 'done':
      return <CheckCircleRounded color="success" fontSize="small" />;
    case 'failed':
      return (
        <Stack direction="row">
          <Tooltip title="Retry">
            <IconButton size="small" onClick={() => storageUploadQueue.retry([item.key])}>
              <ReplayRounded fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Dismiss">
            <IconButton size="small" onClick={() => storageUploadQueue.dismiss([item.key])}>
              <CloseRounded fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      );
    case 'uploading':
      return <CircularProgress size={20} variant="determinate" value={item.progress} />;
    // Made, or sent and being confirmed: nothing to measure.
    case 'creating':
    case 'uploaded':
    case 'completing':
      return <CircularProgress size={20} />;
    default:
      return (
        <Typography variant="caption" color="text.secondary">
          Waiting
        </Typography>
      );
  }
};

const UploadRow: FC<{ item: QueuedUpload }> = ({ item }) => {
  const extension = item.file.name.includes('.') ? item.file.name.split('.').pop() : undefined;
  const kind = getStorageItemKind({
    type: item.kind,
    file: { mimeType: item.file.type, extension: extension ?? '' },
  });

  return (
    <ListItem dense secondaryAction={<UploadState item={item} />} sx={{ pr: 11 }}>
      <ListItemIcon sx={{ minWidth: 36 }}>
        <StorageItemIcon kind={kind} fontSize="small" />
      </ListItemIcon>
      <ListItemText
        primary={item.file.name}
        secondary={
          item.status === 'failed' ? (
            <Box component="span" sx={{ color: 'error.main', display: 'flex', gap: 0.5 }}>
              <ErrorOutlineRounded sx={{ fontSize: 16 }} />
              {item.error}
            </Box>
          ) : (
            <>
              to{' '}
              <Link
                component={NextLink}
                href={pathProvider.getContentPath(STORAGE, STORAGE_OBJECT, item.folder.id)}
                color="inherit"
              >
                {item.folder.name}
              </Link>
            </>
          )
        }
        slotProps={{
          primary: { noWrap: true, title: item.file.name },
          secondary: { noWrap: true },
        }}
      />
    </ListItem>
  );
};

/**
 * Drive's upload box, in the corner of every page: the queue of files dropped on the folder
 * browser, each with its progress, and a retry for what failed. It refreshes the folder listings
 * and the media lists as uploads finish, and asks before the page is left mid-upload.
 */
export const StorageUploadPanel: FC = () => {
  const items = useStorageUploads();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const summary = summarizeUploads(items);
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();
  const doneCount = useRef(0);

  useEffect(() => {
    const hasMore = summary.done > doneCount.current;
    doneCount.current = summary.done;

    if (!hasMore) {
      return;
    }

    const timeout = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: FOLDER_CONTENT_QUERY_KEY });
      [STORAGE_OBJECT, FILE, IMAGE, VIDEO].forEach((resource) =>
        invalidate({ resource, invalidates: ['list'] }),
      );
    }, REFRESH_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [summary.done, queryClient, invalidate]);

  useEffect(() => {
    if (!summary.active) {
      return;
    }

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [summary.active]);

  if (!items.length) {
    return null;
  }

  return (
    <Paper
      elevation={8}
      role="region"
      aria-label="Uploads"
      sx={{
        position: 'fixed',
        right: 16,
        bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        width: 360,
        maxWidth: 'calc(100vw - 32px)',
        zIndex: (theme) => theme.zIndex.snackbar - 1,
        overflow: 'hidden',
      }}
    >
      <Stack direction="row" alignItems="center" gap={1} sx={{ pl: 2, pr: 1, py: 1 }}>
        <Typography variant="subtitle2" sx={{ flex: 1 }} aria-live="polite">
          {getTitle(summary)}
        </Typography>
        {!!summary.failed && !summary.active && (
          <Button size="small" onClick={() => storageUploadQueue.retry()}>
            Retry all
          </Button>
        )}
        <IconButton
          size="small"
          aria-label={isCollapsed ? 'Expand uploads' : 'Collapse uploads'}
          onClick={() => setIsCollapsed((collapsed) => !collapsed)}
        >
          {isCollapsed ? <ExpandLessRounded /> : <ExpandMoreRounded />}
        </IconButton>
        {/* Nothing cancels a transfer, so the box stays until its uploads have ended. */}
        <Tooltip title={summary.active ? 'Uploads are still running' : 'Close'}>
          <span>
            <IconButton
              size="small"
              aria-label="Close uploads"
              disabled={!!summary.active}
              onClick={() => storageUploadQueue.dismiss()}
            >
              <CloseRounded />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      {!!summary.active && <LinearProgress variant="determinate" value={summary.progress} />}
      {!isCollapsed && (
        <List disablePadding sx={{ maxHeight: 320, overflowY: 'auto' }}>
          {items.map((item) => (
            <UploadRow key={item.key} item={item} />
          ))}
        </List>
      )}
    </Paper>
  );
};
