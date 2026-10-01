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
  useIsUploadPanelFolded,
  useStorageUploads,
  useUploadRecordChanges,
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
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
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
import React, { FC, ReactNode, useEffect, useRef, useState } from 'react';
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

const UploadProgress: FC<{ item: QueuedUpload }> = ({ item }) => {
  switch (item.status) {
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

const activeStateSx = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 0.5,
  minWidth: 30,
  minHeight: 30,
  // Drive's: under the pointer — or with the keyboard on it — a row's progress gives way to its
  // cancel. Where nothing hovers, on a touch screen, the two stand side by side.
  '@media (hover: hover)': {
    '& .upload-cancel': { position: 'absolute', opacity: 0 },
    '.MuiListItem-root:hover & .upload-cancel, &:focus-within .upload-cancel': { opacity: 1 },
    '.MuiListItem-root:hover & .upload-progress, &:focus-within .upload-progress': {
      visibility: 'hidden',
    },
  },
} as const;

// What is still on its way — `children`, its progress — with the way to stop it: `name` is what
// the button stops.
const ActiveState: FC<{ name: string; onCancel: () => void; children: ReactNode }> = ({
  name,
  onCancel,
  children,
}) => (
  <Box sx={activeStateSx}>
    <Box className="upload-progress" sx={{ display: 'flex' }}>
      {children}
    </Box>
    <Tooltip title="Cancel">
      <IconButton
        className="upload-cancel"
        size="small"
        aria-label={`Cancel the upload of ${name}`}
        // Not on a double click's second click: the row is gone by then, and the next one's button
        // is under the pointer.
        onClick={(event) => {
          if (event.detail <= 1) {
            onCancel();
          }
        }}
      >
        <CloseRounded fontSize="small" />
      </IconButton>
    </Tooltip>
  </Box>
);

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
    default:
      return (
        <ActiveState name={item.file.name} onCancel={() => storageUploadQueue.cancel([item.key])}>
          <UploadProgress item={item} />
        </ActiveState>
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
      sx={{ pr: 12, pl: nested ? 6 : 2 }}
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
    // Cancelled for the files still on their way: what it has uploaded stays.
    active: (
      <ActiveState name={row.folder.name} onCancel={() => storageUploadQueue.cancel(keys)}>
        <CircularProgress size={20} variant="determinate" value={row.summary.progress} />
      </ActiveState>
    ),
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
          sx={{ pr: 12 }}
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

type CancelUploadsDialogProps = {
  open: boolean;
  // The files still on their way.
  count: number;
  // The failed ones, which leave the box with them.
  failed: number;
  onClose: () => void;
  onConfirm: () => void;
};

/**
 * Confirms cancelling every upload still on its way, as Drive's box does when it is closed
 * mid-upload: one click would otherwise throw away a long transfer. An `alertdialog`, so the
 * folder browser's shortcuts leave its keys alone; the safe answer has the focus.
 */
const CancelUploadsDialog: FC<CancelUploadsDialogProps> = ({
  open,
  count,
  failed,
  onClose,
  onConfirm,
}) => {
  // The counts stay on screen while the dialog fades out after the uploads are gone.
  const shown = useRef({ count, failed });
  shown.current = count ? { count, failed } : shown.current;
  const keepButton = useRef<HTMLButtonElement>(null);
  const isOne = shown.current.count === 1;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="cancel-uploads-title"
      slotProps={{
        paper: { role: 'alertdialog' },
        // Once in: the dialog's focus trap takes the focus as it opens, which wins over `autoFocus`.
        transition: { onEntered: () => keepButton.current?.focus() },
      }}
      // Over the box itself, which lies above every other dialog.
      sx={{ zIndex: (theme) => theme.zIndex.snackbar }}
    >
      <DialogTitle id="cancel-uploads-title">
        {isOne ? 'Cancel the upload?' : `Cancel ${shown.current.count} uploads?`}
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          {isOne ? 'The file' : 'The files'} still on the way will not be uploaded
          {shown.current.failed ? ', and what failed is removed' : ''}. What has been uploaded
          stays.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button ref={keepButton} onClick={onClose}>
          Keep uploading
        </Button>
        <Button color="error" variant="contained" onClick={onConfirm}>
          {isOne ? 'Cancel upload' : 'Cancel uploads'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * Drive's upload box, in the corner of every page: the queue of files dropped on the folder
 * browser, each with its progress, which gives way to a cancel under the pointer — an uploaded
 * folder as one row for all its files, unfolded on a click — and a retry for what failed. Its
 * close empties it, cancelling what is still running once confirmed. It refreshes the folder listings and the
 * media lists as the records of new uploads are made, as uploads finish or fail, and as the record
 * behind a cancelled or dismissed one goes; it asks before the page is left mid-upload, and folds to its header under the full-screen
 * viewer.
 */
export const StorageUploadPanel: FC = () => {
  const items = useStorageUploads();
  const [isCollapsed, setIsCollapsed] = useState(false);
  // The full-screen viewer folds the box to its header, which it would otherwise cover a corner
  // of; opened by hand there, it stays open until the viewer is left.
  const isFolded = useIsUploadPanelFolded();
  const [wasFolded, setWasFolded] = useState(isFolded);
  const [isFoldedCollapsed, setIsFoldedCollapsed] = useState(true);
  const [isAskingCancel, setIsAskingCancel] = useState(false);
  const summary = summarizeUploads(items);
  const rows = groupUploads(items);
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();
  const seen = useRef({ settled: 0, recordChanges: 0 });
  // A failed upload shows in its folder too: its record was made, and the item there says what the
  // upload is at and offers to send it again.
  const settled = summary.done + summary.failed;
  // A record made is a folder item from then on, which shows the upload as it goes; one deleted
  // behind a cancelled or dismissed upload took its item with it.
  const recordChanges = useUploadRecordChanges();

  // A refresh owed stays owed: a dismiss in the meantime lowers `settled`, which runs the effect
  // again and takes the timer with it.
  const isRefreshDue = useRef(false);

  useEffect(() => {
    isRefreshDue.current ||=
      settled > seen.current.settled || recordChanges > seen.current.recordChanges;
    seen.current = { settled, recordChanges };

    if (!isRefreshDue.current) {
      return;
    }

    const timeout = setTimeout(() => {
      isRefreshDue.current = false;
      queryClient.invalidateQueries({ queryKey: FOLDER_CONTENT_QUERY_KEY });
      [STORAGE_OBJECT, FILE, IMAGE, VIDEO].forEach((resource) =>
        invalidate({ resource, invalidates: ['list'] }),
      );
    }, REFRESH_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [settled, recordChanges, queryClient, invalidate]);

  useEffect(() => {
    if (!summary.active) {
      return;
    }

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [summary.active]);

  // The fold starts collapsed, and ends as the box was before it: a choice made under it is its own.
  if (wasFolded !== isFolded) {
    setWasFolded(isFolded);
    setIsFoldedCollapsed(true);
  }

  // The uploads ended by themselves while the question stood: there is nothing left to ask about.
  if (isAskingCancel && !summary.active) {
    setIsAskingCancel(false);
  }

  if (!items.length) {
    return null;
  }

  const isShownCollapsed = isFolded ? isFoldedCollapsed : isCollapsed;
  const isRunning = !!summary.active;
  const closeLabel = isRunning ? 'Cancel all uploads' : 'Close';

  return (
    <>
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
          {!!summary.failed && !isRunning && (
            <Button size="small" onClick={() => storageUploadQueue.retry()}>
              Retry all
            </Button>
          )}
          <IconButton
            size="small"
            aria-label={isShownCollapsed ? 'Expand uploads' : 'Collapse uploads'}
            onClick={() =>
              isFolded ? setIsFoldedCollapsed(!isShownCollapsed) : setIsCollapsed(!isShownCollapsed)
            }
          >
            {isShownCollapsed ? <ExpandLessRounded /> : <ExpandMoreRounded />}
          </IconButton>
          {/* Drive's: it forgets the uploads that have ended, and with some still on their way it
              cancels those first, once that is confirmed. */}
          <Tooltip title={closeLabel}>
            <IconButton
              size="small"
              aria-label={isRunning ? closeLabel : 'Close uploads'}
              onClick={() => (isRunning ? setIsAskingCancel(true) : storageUploadQueue.dismiss())}
            >
              <CloseRounded />
            </IconButton>
          </Tooltip>
        </Stack>
        {isRunning && <LinearProgress variant="determinate" value={summary.progress} />}
        {!isShownCollapsed && (
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
      <CancelUploadsDialog
        open={isAskingCancel}
        count={summary.active}
        failed={summary.failed}
        onClose={() => setIsAskingCancel(false)}
        onConfirm={() => {
          setIsAskingCancel(false);
          storageUploadQueue.cancel();
          // The close it is: what has ended leaves the box too, a failed upload with its record.
          storageUploadQueue.dismiss();
        }}
      />
    </>
  );
};
