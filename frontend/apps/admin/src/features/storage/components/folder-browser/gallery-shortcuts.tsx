'use client';

import { StorageItemKind } from '@/features/storage/helpers';
import { useShortcutLabel } from '@/features/storage/hooks';
import KeyboardOutlined from '@mui/icons-material/KeyboardOutlined';
import { Box, IconButton, IconButtonProps, Tooltip } from '@mui/material';
import React, { FC, Fragment } from 'react';
import { SEEK_STEP_SECONDS } from './use-folder-viewer';

type Props = {
  kind: StorageItemKind;
  isViewer: boolean;
  canOpen: boolean;
  canRename: boolean;
  canDelete: boolean;
  buttonProps?: IconButtonProps;
};

type Shortcut = [keys: string, action: string];

/**
 * The keys of a gallery and its viewer, on a button of their own: most of them press nothing on
 * screen — a video's, a PDF's, the ends of the folder — so no button's tooltip could name them. Only
 * what the item shown answers to is listed.
 */
export const GalleryShortcuts: FC<Props> = ({
  kind,
  isViewer,
  canOpen,
  canRename,
  canDelete,
  buttonProps,
}) => {
  const shortcut = useShortcutLabel();

  const shortcuts: Shortcut[] = [
    ['← →', 'Previous / next'],
    ['Home End', 'First / last'],
    ...(canOpen ? [['Enter', 'Open'] satisfies Shortcut] : []),
    ['Space', isViewer ? 'Exit full screen' : 'Full screen'],
    ['I', 'Info'],
    ...(canRename ? [['F2', 'Rename'] satisfies Shortcut] : []),
    ...(canDelete ? [[shortcut('delete'), 'Delete'] satisfies Shortcut] : []),
    ...(kind === StorageItemKind.VIDEO
      ? ([
          ['K', 'Play / pause'],
          ['J L', `Back / forward ${SEEK_STEP_SECONDS} s`],
          ['M', 'Mute'],
        ] satisfies Shortcut[])
      : []),
    ...(kind === StorageItemKind.PDF
      ? ([
          ['↑ ↓', 'Scroll'],
          ['PgUp PgDn', 'Scroll a page'],
        ] satisfies Shortcut[])
      : []),
  ];

  return (
    <Tooltip
      title={
        <Box sx={{ display: 'grid', gridTemplateColumns: 'auto auto', columnGap: 2, rowGap: 0.25 }}>
          {shortcuts.map(([keys, action]) => (
            <Fragment key={keys}>
              <Box component="span" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                {keys}
              </Box>
              <span>{action}</span>
            </Fragment>
          ))}
        </Box>
      }
    >
      <IconButton aria-label="Keyboard shortcuts" {...buttonProps}>
        <KeyboardOutlined />
      </IconButton>
    </Tooltip>
  );
};
