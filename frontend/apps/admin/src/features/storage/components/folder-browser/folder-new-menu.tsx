'use client';

import AddRounded from '@mui/icons-material/AddRounded';
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined';
import CreateNewFolderOutlined from '@mui/icons-material/CreateNewFolderOutlined';
import DriveFolderUploadOutlined from '@mui/icons-material/DriveFolderUploadOutlined';
import { Button, Divider, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import React, { ChangeEvent, FC, ReactNode, RefObject, useRef, useState } from 'react';
import { MenuShortcut } from './menu-shortcut';
import { MenuPosition, passRightClickOn } from './context-menu';

type Props = {
  // Drive's "New folder": the caller asks for its name, and owns its shortcut (Shift+F).
  onCreateFolder: () => void;
  // Files picked for Drive's "File upload", which go straight into the upload queue.
  onUpload: (files: File[]) => void;
  // A folder picked for Drive's "Folder upload": its files, each with its `webkitRelativePath`.
  onUploadFolder: (files: File[]) => void;
  // Where a right click on the folder's empty space opens the menu, by the pointer. The caller
  // owns it, and takes it back on `onPositionClose`.
  position?: MenuPosition;
  onPositionClose?: () => void;
};

// The directory picker has no React prop: `webkitdirectory` is set on the element itself.
const asDirectoryPicker = (input: HTMLInputElement | null) =>
  input?.setAttribute('webkitdirectory', '');

/**
 * Drive's "New": "Folder" makes one in this folder, "File upload" picks files that upload straight
 * into it, sorted into files, images and videos as a drop is, and "Folder upload" a folder that
 * comes with its whole tree. One menu, opened from its button or — Drive's right click on the
 * folder's empty space — at `position`; the pickers stay mounted either way, since a picker answers
 * after the menu has shut.
 */
export const FolderNewMenu: FC<Props> = ({
  onCreateFolder,
  onUpload,
  onUploadFolder,
  position,
  onPositionClose,
}) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const close = () => {
    setAnchor(null);
    onPositionClose?.();
  };

  const pick = (upload: (files: File[]) => void) => (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    // The same files picked again are a change too.
    event.target.value = '';

    if (files.length) {
      upload(files);
    }
  };

  const renderPicker = (
    label: string,
    icon: ReactNode,
    input: RefObject<HTMLInputElement | null>,
  ) => (
    <MenuItem
      onClick={() => {
        close();
        input.current?.click();
      }}
    >
      <ListItemIcon>{icon}</ListItemIcon>
      <ListItemText>{label}</ListItemText>
    </MenuItem>
  );

  return (
    <>
      <Button
        size="small"
        startIcon={<AddRounded />}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        New
      </Button>
      <input ref={inputRef} type="file" multiple hidden onChange={pick(onUpload)} />
      <input
        ref={(input) => {
          folderInputRef.current = input;
          asDirectoryPicker(input);
        }}
        type="file"
        hidden
        onChange={pick(onUploadFolder)}
      />
      <Menu
        anchorEl={anchor}
        anchorReference={position ? 'anchorPosition' : 'anchorEl'}
        anchorPosition={position}
        open={!!anchor || !!position}
        onClose={close}
        onContextMenu={passRightClickOn(close)}
      >
        <MenuItem
          onClick={() => {
            close();
            onCreateFolder();
          }}
        >
          <ListItemIcon>
            <CreateNewFolderOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>Folder</ListItemText>
          <MenuShortcut name="newFolder" />
        </MenuItem>
        <Divider />
        {renderPicker('File upload', <CloudUploadOutlined fontSize="small" />, inputRef)}
        {renderPicker(
          'Folder upload',
          <DriveFolderUploadOutlined fontSize="small" />,
          folderInputRef,
        )}
      </Menu>
    </>
  );
};
