'use client';

import { getErrorMessage } from '@/common/helpers';
import { useRenameStorageObject } from '@/features/storage/hooks';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import type { BrowserStorage } from '@packages/proto';
import React, { FC, FormEvent, useEffect, useRef, useState } from 'react';

type Item = BrowserStorage.StorageObjectFolderItem;

type Props = {
  // The item to rename — shown while there is one.
  item?: Item;
  onClose: () => void;
};

// What Drive selects as the dialog opens: a file's name without its extension, a folder's whole.
const getSelectionEnd = (item: Item) => {
  const dot = item.name.lastIndexOf('.');
  return item.isFolder || dot <= 0 ? item.name.length : dot;
};

/**
 * Drive's "Rename": the name, ready to type over, applied on Enter. A name taken in the folder is
 * refused by the backend (409) and shown on the field, with any other refusal; the dialog stays open
 * for another try. Its paper keeps the page's shortcuts off its keys (`data-keeps-keys`).
 */
export const RenameStorageItemDialog: FC<Props> = ({ item, onClose }) => {
  const rename = useRenameStorageObject();
  // The item stays on screen while the dialog fades out after it is gone.
  const shown = useRef(item);
  shown.current = item ?? shown.current;
  const target = shown.current;
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { reset } = rename;

  useEffect(() => {
    if (item) {
      setName(item.name);
      reset();
    }
  }, [item, reset]);

  const trimmed = name.trim();
  const isInvalid = trimmed.includes('/');
  const canSave = !!target && !!trimmed && !isInvalid && trimmed !== target.name;
  const error = isInvalid
    ? 'A name cannot contain “/”'
    : rename.error && getErrorMessage(rename.error);

  const close = () => !rename.isPending && onClose();

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (canSave && target) {
      rename.mutate({ id: target.id, name: trimmed }, { onSuccess: onClose });
    }
  };

  return (
    <Dialog
      open={!!item}
      onClose={close}
      maxWidth="xs"
      fullWidth
      aria-labelledby="rename-storage-item-title"
      slotProps={{
        paper: { component: 'form', onSubmit: submit, 'data-keeps-keys': '' } as object,
        // Once in: the menu that asked for the dialog hands the focus back to its button as it
        // closes, which would win over `autoFocus`.
        transition: {
          onEntered: () => {
            const input = inputRef.current;

            if (input && target) {
              input.focus();
              input.setSelectionRange(0, getSelectionEnd(target));
            }
          },
        },
      }}
    >
      <DialogTitle id="rename-storage-item-title">Rename</DialogTitle>
      <DialogContent>
        <TextField
          inputRef={inputRef}
          value={name}
          onChange={(event) => {
            setName(event.target.value);

            if (rename.error) {
              reset();
            }
          }}
          disabled={rename.isPending}
          error={!!error}
          helperText={error || ' '}
          fullWidth
          size="small"
          margin="dense"
          slotProps={{ htmlInput: { 'aria-label': 'New name' } }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={rename.isPending}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={!canSave || rename.isPending}
          startIcon={rename.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
};
