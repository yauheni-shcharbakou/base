'use client';

import { pathProvider } from '@/common/providers';
import {
  getStorageItemKind,
  getUploadRowStatus,
  groupUploads,
  QueuedUpload,
  StorageItemKind,
  summarizeUploads,
  UploadRow,
  UploadRowStatus,
} from '@/features/storage/helpers';
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
  Collapse,
  IconButton,
  LinearProgress,
  Link,
  List,
  ListItem,
  ListItemButton,
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

// Counted in rows, as Drive does: an uploaded folder is one item, however many files it holds.
const getTitle = (rows: UploadRow[]) => {
  const statuses = rows.map(getUploadRowStatus);
  const count = (status: UploadRowStatus) => statuses.filter((each) => each === status).length;
  const total = rows.length;
  const active = count('active');
  const failed = count('failed');
  const done = count('done');

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
        <RowActions
          onRetry={() => storageUploadQueue.retry([item.key])}
          onDismiss={() => storageUploadQueue.dismiss([item.key])}
        />
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

const RowActions: FC<{ onRetry: () => void; onDismiss: () => void }> = ({ onRetry, onDismiss }) => (
  <Stack direction="row">
    <Tooltip title="Retry">
      <IconButton size="small" onClick={onRetry}>
        <ReplayRounded fontSize="small" />
      </IconButton>
    </Tooltip>
    <Tooltip title="Dismiss">
      <IconButton size="small" onClick={onDismiss}>
        <CloseRounded fontSize="small" />
      </IconButton>
    </Tooltip>
  </Stack>
);

// `nested`: one of an uploaded folder's files, shown under its row.
const FileUploadRow: FC<{ item: QueuedUpload; nested?: boolean }> = ({ item, nested }) => {
  const extension = item.file.name.includes('.') ? item.file.name.split('.').pop() : undefined;
  const kind = getStorageItemKind({
    type: item.kind,
    file: { mimeType: item.file.type, extension: extension ?? '' },
  });

  return (
    <ListItem
      dense
      secondaryAction={<UploadState item={item} />}
      sx={{ pr: 11, pl: nested ? 6 : 2 }}
    >
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

type FolderRow = Extract<UploadRow, { type: 'folder' }>;

const getFolderProgressText = ({ summary: { total, done, failed, active } }: FolderRow) => {
  if (active) {
    return `${done} of ${total} uploaded`;
  }

  return failed ? `${failed} of ${total} failed` : `${total} ${total === 1 ? 'file' : 'files'}`;
};

/**
 * An uploaded folder as Drive shows it: one row, with the progress of all its files. A click
 * unfolds the files underneath, the failed ones first, each with its own error and retry.
 */
const FolderUploadRow: FC<{ row: FolderRow }> = ({ row }) => {
  const [isOpen, setIsOpen] = useState(false);
  const status = getUploadRowStatus(row);
  const keys = row.items.map(({ key }) => key);
  const failed = row.items.filter((item) => item.status === 'failed');
  const files = [...failed, ...row.items.filter((item) => item.status !== 'failed')];

  const state = {
    active: <CircularProgress size={20} variant="determinate" value={row.summary.progress} />,
    // Dismissed whole: its uploaded files leave the box with the failed ones.
    failed: (
      <RowActions
        onRetry={() => storageUploadQueue.retry(failed.map(({ key }) => key))}
        onDismiss={() => storageUploadQueue.dismiss(keys)}
      />
    ),
    done: <CheckCircleRounded color="success" fontSize="small" />,
  }[status];

  return (
    <>
      <ListItem dense disablePadding secondaryAction={state}>
        <ListItemButton
          dense
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
          sx={{ pr: 11 }}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            <StorageItemIcon kind={StorageItemKind.FOLDER} fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary={
              <Link
                component={NextLink}
                href={pathProvider.getContentPath(STORAGE, STORAGE_OBJECT, row.folder.id)}
                color="inherit"
                underline="hover"
                // The name opens the folder; the rest of the row unfolds it.
                onClick={(event) => event.stopPropagation()}
              >
                {row.folder.name}
              </Link>
            }
            secondary={
              <Box component="span" sx={{ color: status === 'failed' ? 'error.main' : undefined }}>
                {getFolderProgressText(row)}
              </Box>
            }
            slotProps={{
              primary: { noWrap: true, title: row.folder.name },
              secondary: { noWrap: true },
            }}
          />
          <ExpandMoreRounded
            fontSize="small"
            color="action"
            sx={{ ml: 1, transform: isOpen ? 'rotate(180deg)' : undefined }}
          />
        </ListItemButton>
      </ListItem>
      <Collapse in={isOpen} unmountOnExit>
        <List disablePadding aria-label={`Files of ${row.folder.name}`}>
          {files.map((item) => (
            <FileUploadRow key={item.key} item={item} nested />
          ))}
        </List>
      </Collapse>
    </>
  );
};

/**
 * Drive's upload box, in the corner of every page: the queue of files dropped on the folder
 * browser, each with its progress — an uploaded folder as one row for all its files, unfolded on a
 * click — and a retry for what failed. It refreshes the folder listings and the media lists as
 * uploads finish or fail, and asks before the page is left mid-upload.
 */
export const StorageUploadPanel: FC = () => {
  const items = useStorageUploads();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const summary = summarizeUploads(items);
  const rows = groupUploads(items);
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();
  const settledCount = useRef(0);
  // A failed upload shows in its folder too: its record was made, and the item there says what the
  // upload is at and offers to send it again.
  const settled = summary.done + summary.failed;

  useEffect(() => {
    const hasMore = settled > settledCount.current;
    settledCount.current = settled;

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
  }, [settled, queryClient, invalidate]);

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
          {getTitle(rows)}
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
          {rows.map((row) =>
            row.type === 'folder' ? (
              <FolderUploadRow key={row.key} row={row} />
            ) : (
              <FileUploadRow key={row.key} item={row.item} />
            ),
          )}
        </List>
      )}
    </Paper>
  );
};
