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
  Checkbox,
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
import type { FolderItemBehavior } from './use-folder-item-behavior';

type Item = BrowserStorage.StorageObjectFolderItem;

type Props = {
  items: Item[];
  behavior: FolderItemBehavior;
  params: Pick<FolderContentParams, 'sortBy' | 'sortOrder'>;
  onSortChange: (
    sortBy: BrowserStorage.StorageObjectSortField,
    sortOrder: BrowserCommon.Sort,
  ) => void;
  onToggleAll: () => void;
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

// A row's checkbox shows under the pointer, and on every row once one is selected.
const rowSx = {
  cursor: 'default',
  userSelect: 'none',
  '& .item-check': { opacity: 0 },
  '&:hover .item-check, &[data-selecting] .item-check, & .item-check.Mui-checked': { opacity: 1 },
} as const;

/**
 * Google Drive's list: one row per item, sorted by clicking a column, folders on top. A click
 * selects a row, a double click opens it; a folder's row takes a drop of other items.
 */
export const FolderListView: FC<Props> = ({
  items,
  behavior,
  params,
  onSortChange,
  onToggleAll,
}) => {
  const focusedRow = useRef<HTMLTableRowElement>(null);
  const { selectedIds, focusedId, dropTargetId, menu } = behavior;
  const selectedCount = items.filter(({ id }) => selectedIds.has(id)).length;

  // The row the keyboard is on comes into view with the focus, so Enter opens it.
  useEffect(() => {
    focusedRow.current?.scrollIntoView({ block: 'nearest' });
    focusedRow.current?.focus({ preventScroll: true });
  }, [focusedId]);

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
            <TableCell padding="checkbox">
              <Checkbox
                size="small"
                checked={!!items.length && selectedCount === items.length}
                indeterminate={!!selectedCount && selectedCount < items.length}
                onChange={onToggleAll}
                inputProps={{ 'aria-label': 'Select all on this page' }}
              />
            </TableCell>
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
                ref={item.id === focusedId ? focusedRow : undefined}
                hover
                selected={selectedIds.has(item.id)}
                aria-selected={selectedIds.has(item.id)}
                tabIndex={0}
                data-selecting={selectedIds.size ? '' : undefined}
                {...behavior.getItemProps(item)}
                sx={{
                  ...rowSx,
                  // Marked for the keyboard but not selected — the folder just left.
                  ...((item.id === dropTargetId ||
                    (item.id === focusedId && !selectedIds.has(item.id))) && {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: -2,
                  }),
                }}
              >
                <TableCell padding="checkbox">
                  <Checkbox
                    className="item-check"
                    size="small"
                    checked={selectedIds.has(item.id)}
                    onClick={(event) => event.stopPropagation()}
                    onChange={() => behavior.onToggle(item)}
                    inputProps={{ 'aria-label': `Select ${item.name}` }}
                  />
                </TableCell>
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
                  <StorageItemMenu
                    item={item}
                    getFolderHref={menu.getFolderHref}
                    onMenuOpen={menu.onMenuOpen}
                    onMove={menu.onMove}
                    onDelete={menu.onDelete}
                    actionCount={menu.getActionCount(item)}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
