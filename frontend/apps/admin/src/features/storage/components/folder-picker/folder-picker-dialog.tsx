'use client';

import {
  getBlockedFolderIds,
  getFolderLabel,
  getFolderTrail,
  searchFolders,
  toFolderTree,
} from '@/features/storage/helpers';
import { getErrorMessage } from '@/common/helpers';
import { useCreateFolder, useRootFolderLabel, useUserFolders } from '@/features/storage/hooks';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import CreateNewFolderOutlined from '@mui/icons-material/CreateNewFolderOutlined';
import FolderOutlined from '@mui/icons-material/FolderOutlined';
import NavigateNextRounded from '@mui/icons-material/NavigateNextRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import {
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Link,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { BrowserStorage } from '@packages/proto';
import React, { FC, useMemo, useState } from 'react';

type Folder = BrowserStorage.StorageObjectPopulated;

type Props = {
  open: boolean;
  title: string;
  // Whose folders to pick from.
  userId: string;
  // The folder shown first; the owner's root without it.
  initialLocation?: string;
  // The folder picked on opening — a field's value — shown in its parent instead.
  initialPickedId?: string;
  // Folders nothing may go into, with everything under them: they show, but cannot be picked or
  // opened.
  blockedIds?: string[];
  // A folder that is no answer, though its subfolders may be: where the items already are.
  currentId?: string;
  confirmLabel: string;
  isBusy?: boolean;
  onCancel: () => void;
  onConfirm: (folder: Folder) => void;
};

/**
 * Drive's folder picker: one folder at a time, with its path above and its subfolders below. A click
 * picks a subfolder, a double click or its arrow opens it, and the path or the back arrow goes up.
 * With none picked, the answer is the folder shown. A search looks through every folder of the
 * owner by name, and a new folder can be made in the one shown — it comes out picked.
 */
export const FolderPickerDialog: FC<Props> = ({
  open,
  title,
  userId,
  initialLocation,
  initialPickedId,
  blockedIds,
  currentId,
  confirmLabel,
  isBusy = false,
  onCancel,
  onConfirm,
}) => {
  const folders = useUserFolders(userId, { enabled: open });
  const rootLabel = useRootFolderLabel(userId);
  const [location, setLocation] = useState<string>();
  // Undefined until the viewer picks, or leaves, a folder: `initialPickedId` stands until then.
  const [pickedId, setPickedId] = useState<string | null>();
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState<string>();
  const creation = useCreateFolder();

  const tree = useMemo(() => toFolderTree(folders.data ?? []), [folders.data]);
  const blocked = useMemo(() => getBlockedFolderIds(tree, blockedIds ?? []), [tree, blockedIds]);

  const isOpenable = (id?: string): id is string => !!id && tree.byId.has(id) && !blocked.has(id);
  const initialPick = isOpenable(initialPickedId) ? tree.byId.get(initialPickedId) : undefined;
  const initial =
    initialPick?.parentId ?? (isOpenable(initialLocation) ? initialLocation : tree.root?.id);
  const shownId = location ?? initial;
  const picked = pickedId === undefined ? initialPick?.parentId && initialPick.id : pickedId;
  const trail = getFolderTrail(tree, shownId);
  const parent = trail[trail.length - 2];
  const isSearching = !!query.trim();
  const rows = isSearching
    ? searchFolders(folders.data ?? [], query)
    : (tree.childrenOf.get(shownId) ?? []);
  const target = tree.byId.get(picked || shownId || '');
  const canConfirm = !!target && !blocked.has(target.id) && target.id !== currentId && !isBusy;

  const labelOf = (folder: Folder) => folder.name || rootLabel;

  const go = (folder: Folder) => {
    if (blocked.has(folder.id)) {
      return;
    }

    setLocation(folder.id);
    setPickedId(null);
    setQuery('');
    stopCreating();
  };

  const stopCreating = () => {
    setNewName(undefined);
    creation.reset();
  };

  const reset = () => {
    setLocation(undefined);
    setPickedId(undefined);
    setQuery('');
    stopCreating();
  };

  const create = () => {
    if (!shownId || !newName?.trim() || creation.isPending) {
      return;
    }

    creation.mutate(
      { userId, parent: shownId, name: newName },
      {
        onSuccess: (folder) => {
          stopCreating();
          setPickedId(folder.id);
        },
      },
    );
  };

  const renderNewFolder = () => (
    <Stack direction="row" alignItems="flex-start" gap={1}>
      <TextField
        value={newName ?? ''}
        onChange={(event) => {
          setNewName(event.target.value);
          creation.reset();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            create();
          } else if (event.key === 'Escape') {
            // The field's own Esc: the dialog stays open.
            event.stopPropagation();
            stopCreating();
          }
        }}
        placeholder="New folder name"
        size="small"
        fullWidth
        autoFocus
        error={creation.isError}
        helperText={creation.isError ? getErrorMessage(creation.error) : undefined}
        slotProps={{
          // Read-only, not disabled, while it is sent: a disabled field loses the focus, and Esc
          // would then close the whole dialog.
          htmlInput: { 'aria-label': 'New folder name', readOnly: creation.isPending },
        }}
      />
      <Button onClick={stopCreating} disabled={creation.isPending}>
        Cancel
      </Button>
      <Button variant="outlined" onClick={create} disabled={!newName?.trim() || creation.isPending}>
        Create
      </Button>
    </Stack>
  );

  const renderRows = () => {
    if (folders.isPending) {
      return (
        <Stack alignItems="center" justifyContent="center" sx={{ height: 1 }}>
          <CircularProgress size={24} />
        </Stack>
      );
    }

    if (!rows.length) {
      return (
        <Stack alignItems="center" justifyContent="center" sx={{ height: 1 }}>
          <Typography color="text.secondary">
            {isSearching ? 'No folders match' : 'No folders in here'}
          </Typography>
        </Stack>
      );
    }

    return (
      <List dense disablePadding aria-label="Folders">
        {rows.map((folder) => {
          const isBlocked = blocked.has(folder.id);
          // Any folder that may be entered, an empty one too: a new folder can be made in it.
          const canOpen = !isBlocked;
          const isInitialPick = pickedId === undefined && folder.id === picked;

          return (
            <ListItem
              key={folder.id}
              disablePadding
              secondaryAction={
                canOpen && (
                  <IconButton
                    edge="end"
                    size="small"
                    aria-label={`Open ${labelOf(folder)}`}
                    onClick={() => go(folder)}
                  >
                    <ChevronRightRounded fontSize="small" />
                  </IconButton>
                )
              }
            >
              <ListItemButton
                selected={folder.id === picked}
                disabled={isBlocked}
                ref={
                  isInitialPick
                    ? (element) => element?.scrollIntoView({ block: 'nearest' })
                    : undefined
                }
                onClick={() => setPickedId(folder.id)}
                onDoubleClick={() => go(folder)}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <FolderOutlined fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={labelOf(folder)}
                  secondary={isSearching ? getFolderLabel(folder, rootLabel) : undefined}
                  slotProps={{ primary: { noWrap: true }, secondary: { noWrap: true } }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={() => !isBusy && onCancel()}
      maxWidth="sm"
      fullWidth
      aria-labelledby="folder-picker-title"
      slotProps={{ transition: { onExited: reset } }}
    >
      <DialogTitle id="folder-picker-title" sx={{ wordBreak: 'break-word' }}>
        {title}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <TextField
          value={query}
          onChange={(event) => {
            // A pick the results may no longer show is no answer to leave standing.
            setQuery(event.target.value);
            setPickedId(null);
            stopCreating();
          }}
          placeholder="Search folders"
          size="small"
          fullWidth
          autoFocus
          sx={{ mt: 1 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        {/* Holds its height while searching, so the buttons below stay where they were. */}
        {isSearching ? (
          <Typography
            color="text.secondary"
            sx={{ minHeight: 36, display: 'flex', alignItems: 'center' }}
          >
            In every folder
          </Typography>
        ) : (
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ minHeight: 36 }}>
            <IconButton
              size="small"
              aria-label="Up one folder"
              disabled={!parent}
              onClick={() => parent && go(parent)}
            >
              <ArrowBackRounded fontSize="small" />
            </IconButton>
            <Breadcrumbs
              separator={<NavigateNextRounded fontSize="small" />}
              aria-label="Folder path"
              sx={{ minWidth: 0, '& .MuiBreadcrumbs-ol': { flexWrap: 'wrap' } }}
            >
              {trail.map((folder, index) =>
                index === trail.length - 1 ? (
                  <Typography key={folder.id} fontWeight={500} sx={{ wordBreak: 'break-word' }}>
                    {labelOf(folder)}
                  </Typography>
                ) : (
                  <Link
                    key={folder.id}
                    component="button"
                    type="button"
                    underline="hover"
                    color="text.secondary"
                    onClick={() => go(folder)}
                  >
                    {labelOf(folder)}
                  </Link>
                ),
              )}
            </Breadcrumbs>
            <Tooltip title="New folder here" placement="left">
              <span style={{ marginLeft: 'auto' }}>
                <IconButton
                  size="small"
                  aria-label="New folder"
                  disabled={!shownId || newName !== undefined}
                  onClick={() => setNewName('')}
                >
                  <CreateNewFolderOutlined fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        )}
        {newName !== undefined && renderNewFolder()}
        <Box
          sx={{
            height: 320,
            overflowY: 'auto',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
          }}
        >
          {renderRows()}
        </Box>
      </DialogContent>
      <DialogActions sx={{ gap: 1, px: 3 }}>
        <Typography
          variant="body2"
          color="text.secondary"
          noWrap
          sx={{ flex: 1, minWidth: 0 }}
          title={target ? getFolderLabel(target, rootLabel) : undefined}
        >
          {target && `To: ${getFolderLabel(target, rootLabel)}`}
        </Typography>
        <Button onClick={onCancel} disabled={isBusy}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!canConfirm}
          startIcon={isBusy ? <CircularProgress size={16} color="inherit" /> : undefined}
          onClick={() => target && onConfirm(target)}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
