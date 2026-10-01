'use client';

import AddRounded from '@mui/icons-material/AddRounded';
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined';
import CreateNewFolderOutlined from '@mui/icons-material/CreateNewFolderOutlined';
import DriveFolderUploadOutlined from '@mui/icons-material/DriveFolderUploadOutlined';
import {
  Button,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import React, { ChangeEvent, FC, ReactNode, RefObject, useRef, useState } from 'react';

type Props = {
  // Drive's "New folder": the caller asks for its name, and owns its shortcut (Shift+F).
  onCreateFolder: () => void;
  // Files picked for Drive's "File upload", which go straight into the upload queue.
  onUpload: (files: File[]) => void;
  // A folder picked for Drive's "Folder upload": its files, each with its `webkitRelativePath`.
  onUploadFolder: (files: File[]) => void;
};

// The directory picker has no React prop: `webkitdirectory` is set on the element itself.
const asDirectoryPicker = (input: HTMLInputElement | null) =>
  input?.setAttribute('webkitdirectory', '');

/**
 * Drive's "New": "Folder" makes one in this folder, "File upload" picks files that upload straight
 * into it, sorted into files, images and videos as a drop is, and "Folder upload" a folder that
 * comes with its whole tree.
 */
export const FolderNewMenu: FC<Props> = ({ onCreateFolder, onUpload, onUploadFolder }) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const close = () => setAnchor(null);

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
      <Menu anchorEl={anchor} open={!!anchor} onClose={close}>
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
          <Typography variant="body2" sx={{ ml: 3, color: 'text.secondary' }}>
            ⇧F
          </Typography>
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
