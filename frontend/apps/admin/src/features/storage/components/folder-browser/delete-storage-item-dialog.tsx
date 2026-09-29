'use client';

import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import type { BrowserStorage } from '@packages/proto';
import React, { FC, useRef } from 'react';

type Props = {
  item?: BrowserStorage.StorageObjectFolderItem;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: (item: BrowserStorage.StorageObjectFolderItem) => void;
};

/**
 * Confirms a delete, which cannot be undone: the service marks the item — a folder with everything
 * under it — deleted, and never restores it. Delete has the focus, so ⌘⌫ then Enter deletes, as
 * Finder's "Delete Immediately" does. An `alertdialog`, so the page's shortcuts leave its keys alone.
 */
export const DeleteStorageItemDialog: FC<Props> = ({ item, isDeleting, onCancel, onConfirm }) => {
  // The item stays on screen while the dialog fades out after it is gone.
  const shown = useRef(item);
  shown.current = item ?? shown.current;
  const target = shown.current;
  const deleteButton = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      open={!!item}
      onClose={() => !isDeleting && onCancel()}
      maxWidth="xs"
      fullWidth
      aria-labelledby="delete-storage-item-title"
      slotProps={{
        paper: { role: 'alertdialog' },
        // Once in: the menu that asked for the dialog hands the focus back to its button as it
        // closes, which would win over `autoFocus`.
        transition: { onEntered: () => deleteButton.current?.focus() },
      }}
    >
      <DialogTitle id="delete-storage-item-title" sx={{ wordBreak: 'break-word' }}>
        Delete “{target?.name}”?
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          {target?.isFolder && 'The folder and everything in it will be deleted. '}
          This can’t be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={isDeleting}>
          Cancel
        </Button>
        <Button
          ref={deleteButton}
          color="error"
          variant="contained"
          disabled={isDeleting}
          startIcon={isDeleting ? <CircularProgress size={16} color="inherit" /> : undefined}
          onClick={() => item && onConfirm(item)}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
};
