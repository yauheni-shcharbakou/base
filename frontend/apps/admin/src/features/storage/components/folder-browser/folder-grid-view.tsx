'use client';

import { Box, Stack, Typography } from '@mui/material';
import type { BrowserStorage } from '@packages/proto';
import React, { FC, ReactNode } from 'react';
import { FolderItemCard } from './folder-item-card';

type Item = BrowserStorage.StorageObjectFolderItem;

type Props = {
  items: Item[];
  selectedId?: string;
  onOpen: (item: Item) => void;
  onDelete?: (item: Item) => void;
  onPreviewError?: () => void;
  getFolderHref?: (id: string) => string;
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
export const FolderGridView: FC<Props> = ({ items, selectedId, ...cardProps }) => {
  const folders = items.filter((item) => item.isFolder);
  const files = items.filter((item) => !item.isFolder);

  return (
    <Stack gap={3}>
      {!!folders.length && (
        <Section title="Folders" minWidth={220}>
          {folders.map((item) => (
            <FolderItemCard
              key={item.id}
              item={item}
              isSelected={item.id === selectedId}
              {...cardProps}
            />
          ))}
        </Section>
      )}
      {!!files.length && (
        <Section title="Files" minWidth={200}>
          {files.map((item) => (
            <FolderItemCard
              key={item.id}
              item={item}
              isSelected={item.id === selectedId}
              {...cardProps}
            />
          ))}
        </Section>
      )}
    </Stack>
  );
};
