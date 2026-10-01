'use client';

import { useRootFolderLabel, useShortcutLabel } from '@/features/storage/hooks';
import NavigateNextRounded from '@mui/icons-material/NavigateNextRounded';
import { Breadcrumbs, Link, Tooltip, Typography } from '@mui/material';
import type { BrowserStorage } from '@packages/proto';
import NextLink from 'next/link';
import React, { DragEvent, FC } from 'react';
import type { DropFolder } from './use-folder-item-behavior';

type DropProps = {
  onDragOver: (event: DragEvent) => void;
  onDragLeave: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
};

type Props = {
  folder: BrowserStorage.StorageObject;
  ancestors: BrowserStorage.StorageObjectAncestor[];
  // An ancestor's link, with the folder that leads back down marked.
  getAncestorHref: (id: string) => string;
  // Drive's breadcrumbs take a drop: items dragged onto a folder above move there.
  getDropProps?: (folder: DropFolder) => DropProps;
  dropTargetId?: string;
};

/**
 * The path from the owner's root down to this folder, as Drive's title shows it. A root has no
 * name, so it goes by its owner's email.
 */
export const FolderBreadcrumbs: FC<Props> = ({
  folder,
  ancestors,
  getAncestorHref,
  getDropProps,
  dropTargetId,
}) => {
  const rootLabel = useRootFolderLabel(folder.userId);
  const shortcut = useShortcutLabel();
  const labelOf = (name: string) => name || rootLabel;

  return (
    <Breadcrumbs
      separator={<NavigateNextRounded fontSize="small" />}
      aria-label="Folder path"
      sx={{ '& .MuiBreadcrumbs-ol': { flexWrap: 'wrap' } }}
    >
      {ancestors.map((ancestor, index) => (
        // The parent is where ⌘↑ goes; the folders above it have no key. It describes the link: a
        // tooltip's title would otherwise replace the folder's name as the link's label.
        <Tooltip
          key={ancestor.id}
          title={index === ancestors.length - 1 ? `Go up (${shortcut('goUp')})` : ''}
          describeChild
        >
          <Link
            component={NextLink}
            href={getAncestorHref(ancestor.id)}
            underline="hover"
            color="text.secondary"
            variant="h6"
            fontWeight={400}
            {...getDropProps?.({ id: ancestor.id, name: labelOf(ancestor.name) })}
            sx={{
              px: 0.5,
              mx: -0.5,
              borderRadius: 1,
              ...(ancestor.id === dropTargetId && {
                bgcolor: 'action.selected',
                color: 'primary.main',
              }),
            }}
          >
            {labelOf(ancestor.name)}
          </Link>
        </Tooltip>
      ))}
      <Typography variant="h6" color="text.primary" aria-current="page">
        {labelOf(folder.name)}
      </Typography>
    </Breadcrumbs>
  );
};
