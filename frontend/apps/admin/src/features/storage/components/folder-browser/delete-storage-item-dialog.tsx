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

type Item = BrowserStorage.StorageObjectFolderItem;

type Props = {
  // The items to delete — shown while there are any.
  items?: Item[];
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: (items: Item[]) => void;
};

const getTitle = (items: Item[]) =>
  items.length === 1 ? `Delete “${items[0].name}”?` : `Delete ${items.length} items?`;

const getWarning = (items: Item[]) => {
  const folders = items.filter((item) => item.isFolder).length;

  if (!folders) {
    return '';
  }

  if (items.length === 1) {
    return 'The folder and everything in it will be deleted. ';
  }

  return folders === 1
    ? 'The folder among them goes with everything in it. '
    : 'The folders among them go with everything in them. ';
};

/**
 * Confirms a delete of one item or several, which cannot be undone: the service marks the items — a
 * folder with everything under it — deleted, and never restores them. Delete has the focus, so ⌘⌫ then Enter deletes, as
 * Finder's "Delete Immediately" does. An `alertdialog`, so the page's shortcuts leave its keys alone.
 */
export const DeleteStorageItemDialog: FC<Props> = ({ items, isDeleting, onCancel, onConfirm }) => {
  // The items stay on screen while the dialog fades out after they are gone.
  const shown = useRef(items);
  shown.current = items?.length ? items : shown.current;
  const targets = shown.current ?? [];
  const deleteButton = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      open={!!items?.length}
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
        {getTitle(targets)}
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          {getWarning(targets)}
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
          onClick={() => items?.length && onConfirm(items)}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
};
