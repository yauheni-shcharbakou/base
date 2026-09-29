'use client';

import {
  FolderContentParams,
  formatDateTime,
  getFileSize,
  getStorageItemKind,
  STORAGE_ITEM_KIND_LABELS,
} from '@/features/storage/helpers';
import PublicOutlined from '@mui/icons-material/PublicOutlined';
import {
  Box,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material';
import { BrowserCommon, BrowserStorage } from '@packages/proto';
import React, { FC, useEffect, useRef } from 'react';
import { StorageItemIcon } from './storage-item-icon';
import { StorageItemMenu } from './storage-item-menu';

type Item = BrowserStorage.StorageObjectFolderItem;

type Props = {
  items: Item[];
  // Marked — the folder just left, as Finder selects it.
  selectedId?: string;
  params: Pick<FolderContentParams, 'sortBy' | 'sortOrder'>;
  onSortChange: (
    sortBy: BrowserStorage.StorageObjectSortField,
    sortOrder: BrowserCommon.Sort,
  ) => void;
  onOpen: (item: Item) => void;
  onDelete?: (item: Item) => void;
  getFolderHref?: (id: string) => string;
};

const { NAME, TYPE, UPDATED_AT, CREATED_AT } = BrowserStorage.StorageObjectSortField;
const { asc, desc } = BrowserCommon.Sort;

// A date column starts from the newest, as Drive's does.
const FIRST_ORDER: Record<BrowserStorage.StorageObjectSortField, BrowserCommon.Sort> = {
  [NAME]: asc,
  [TYPE]: asc,
  [UPDATED_AT]: desc,
  [CREATED_AT]: desc,
};

/** Google Drive's list: one row per item, sorted by clicking a column. Folders stay on top. */
export const FolderListView: FC<Props> = ({
  items,
  selectedId,
  params,
  onSortChange,
  onOpen,
  onDelete,
  getFolderHref,
}) => {
  const selectedRow = useRef<HTMLTableRowElement>(null);

  // The marked row comes into view with the focus, so Enter goes straight back in.
  useEffect(() => {
    selectedRow.current?.scrollIntoView({ block: 'nearest' });
    selectedRow.current?.focus({ preventScroll: true });
  }, [selectedId]);

  const sortLabel = (field: BrowserStorage.StorageObjectSortField, label: string) => {
    const isActive = params.sortBy === field;

    return (
      <TableSortLabel
        active={isActive}
        direction={isActive ? params.sortOrder : FIRST_ORDER[field]}
        onClick={() =>
          onSortChange(
            field,
            isActive ? (params.sortOrder === asc ? desc : asc) : FIRST_ORDER[field],
          )
        }
      >
        {label}
      </TableSortLabel>
    );
  };

  return (
    <TableContainer>
      <Table size="small" sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: '100%' }}>{sortLabel(NAME, 'Name')}</TableCell>
            <TableCell>{sortLabel(TYPE, 'Type')}</TableCell>
            <TableCell>{sortLabel(UPDATED_AT, 'Last modified')}</TableCell>
            <TableCell>{sortLabel(CREATED_AT, 'Date created')}</TableCell>
            <TableCell align="right">Size</TableCell>
            <TableCell padding="checkbox" />
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => {
            const kind = getStorageItemKind(item);

            return (
              <TableRow
                key={item.id}
                ref={item.id === selectedId ? selectedRow : undefined}
                hover
                selected={item.id === selectedId}
                aria-current={item.id === selectedId || undefined}
                tabIndex={0}
                onClick={() => onOpen(item)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && event.target === event.currentTarget) {
                    onOpen(item);
                  }
                }}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell sx={{ maxWidth: 0 }}>
                  <Stack direction="row" alignItems="center" gap={1.5} sx={{ minWidth: 0 }}>
                    <StorageItemIcon kind={kind} fontSize="small" />
                    <Typography variant="body2" noWrap title={item.name}>
                      {item.name}
                    </Typography>
                    {item.isPublic && (
                      <Box component="span" title="Public" sx={{ display: 'flex' }}>
                        <PublicOutlined sx={{ fontSize: 16, color: 'text.secondary' }} />
                      </Box>
                    )}
                  </Stack>
                </TableCell>
                <TableCell>{STORAGE_ITEM_KIND_LABELS[kind]}</TableCell>
                <TableCell>{formatDateTime(item.updatedAt ?? item.createdAt)}</TableCell>
                <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                <TableCell align="right">{item.file ? getFileSize(item.file.size) : '—'}</TableCell>
                <TableCell padding="checkbox">
                  <StorageItemMenu item={item} getFolderHref={getFolderHref} onDelete={onDelete} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
