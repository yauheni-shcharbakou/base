'use client';

import { Box, Stack, Typography } from '@mui/material';
import type { BrowserStorage } from '@packages/proto';
import React, { FC, ReactNode } from 'react';
import { FolderItemCard } from './folder-item-card';
import type { FolderItemBehavior } from './use-folder-item-behavior';

type Item = BrowserStorage.StorageObjectFolderItem;

type Props = {
  items: Item[];
  behavior: FolderItemBehavior;
  onPreviewError?: () => void;
};

const Section: FC<{ title: string; minWidth: number; children: ReactNode }> = ({
  title,
  minWidth,
  children,
}) => (
  <Box>
    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
      {title}
    </Typography>
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))`,
        gap: 2,
      }}
    >
      {children}
    </Box>
  </Box>
);

/** Google Drive's grid: the page's folders, which the listing puts first, then its files. */
export const FolderGridView: FC<Props> = ({ items, behavior, onPreviewError }) => {
  const folders = items.filter((item) => item.isFolder);
  const files = items.filter((item) => !item.isFolder);

  return (
    <Stack gap={3}>
      {!!folders.length && (
        <Section title="Folders" minWidth={220}>
          {folders.map((item) => (
            <FolderItemCard key={item.id} item={item} behavior={behavior} />
          ))}
        </Section>
      )}
      {!!files.length && (
        <Section title="Files" minWidth={200}>
          {files.map((item) => (
            <FolderItemCard
              key={item.id}
              item={item}
              behavior={behavior}
              onPreviewError={onPreviewError}
            />
          ))}
        </Section>
      )}
    </Stack>
  );
};
