'use client';

import { useShortcutLabel } from '@/features/storage/hooks';
import CloseRounded from '@mui/icons-material/CloseRounded';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import DriveFileMoveOutlined from '@mui/icons-material/DriveFileMoveOutlined';
import PublicOffOutlined from '@mui/icons-material/PublicOffOutlined';
import PublicOutlined from '@mui/icons-material/PublicOutlined';
import { IconButton, Stack, Tooltip, Typography } from '@mui/material';
import React, { FC } from 'react';

type Props = {
  count: number;
  onClear: () => void;
  onMove: () => void;
  onDelete: () => void;
  onPublicChange: (isPublic: boolean) => void;
  // The folder shown is public: nothing in it goes private.
  isPublicLocked: boolean;
};

/** Drive's bar over a selection: how many, and what to do with them all. */
export const FolderSelectionBar: FC<Props> = ({
  count,
  onClear,
  onMove,
  onDelete,
  onPublicChange,
  isPublicLocked,
}) => {
  const shortcut = useShortcutLabel();

  return (
    <Stack
      direction="row"
      alignItems="center"
      gap={0.5}
      sx={{ minHeight: 40, px: 0.5, borderRadius: 5, bgcolor: 'action.selected' }}
    >
      <Tooltip title="Clear selection (Esc)">
        <IconButton size="small" onClick={onClear} aria-label="Clear selection">
          <CloseRounded fontSize="small" />
        </IconButton>
      </Tooltip>
      <Typography variant="body2" fontWeight={500} sx={{ mr: 1 }} aria-live="polite">
        {count} selected
      </Typography>
      <Tooltip title="Move to…">
        <IconButton size="small" onClick={onMove} aria-label="Move selected items">
          <DriveFileMoveOutlined fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Make public">
        <IconButton
          size="small"
          onClick={() => onPublicChange(true)}
          aria-label="Make selected items public"
        >
          <PublicOutlined fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title={isPublicLocked ? 'Everything in a public folder is public' : 'Make private'}>
        {/* A disabled button fires no events: the span keeps the tooltip. */}
        <span>
          <IconButton
            size="small"
            disabled={isPublicLocked}
            onClick={() => onPublicChange(false)}
            aria-label="Make selected items private"
          >
            <PublicOffOutlined fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={`Delete (${shortcut('delete')})`}>
        <IconButton size="small" onClick={onDelete} aria-label="Delete selected items">
          <DeleteOutlined fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
};
