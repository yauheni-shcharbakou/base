'use client';

import { FolderContentParams, FolderView, getStorageItemKind } from '@/features/storage/helpers';
import ArrowDownwardRounded from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import ClearRounded from '@mui/icons-material/ClearRounded';
import FilterListRounded from '@mui/icons-material/FilterListRounded';
import GridViewOutlined from '@mui/icons-material/GridViewOutlined';
import SearchRounded from '@mui/icons-material/SearchRounded';
import SortRounded from '@mui/icons-material/SortRounded';
import ViewCarouselOutlined from '@mui/icons-material/ViewCarouselOutlined';
import ViewListOutlined from '@mui/icons-material/ViewListOutlined';
import {
  Button,
  Checkbox,
  Divider,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { BrowserCommon, BrowserStorage } from '@packages/proto';
import React, { FC, useEffect, useState } from 'react';
import { StorageItemIcon } from './storage-item-icon';

type Props = {
  params: FolderContentParams;
  total?: number;
  onChange: (patch: Partial<FolderContentParams>, mode?: 'push' | 'replace') => void;
};

const SORT_LABELS: Record<BrowserStorage.StorageObjectSortField, string> = {
  [BrowserStorage.StorageObjectSortField.NAME]: 'Name',
  [BrowserStorage.StorageObjectSortField.UPDATED_AT]: 'Last modified',
  [BrowserStorage.StorageObjectSortField.CREATED_AT]: 'Date created',
  [BrowserStorage.StorageObjectSortField.TYPE]: 'Type',
};

const TYPE_LABELS: Record<BrowserStorage.StorageObjectType, string> = {
  [BrowserStorage.StorageObjectType.FOLDER]: 'Folders',
  [BrowserStorage.StorageObjectType.FILE]: 'Files',
  [BrowserStorage.StorageObjectType.IMAGE]: 'Images',
  [BrowserStorage.StorageObjectType.VIDEO]: 'Videos',
};

const VIEWS = [
  { value: FolderView.GRID, label: 'Grid', Icon: GridViewOutlined },
  { value: FolderView.LIST, label: 'List', Icon: ViewListOutlined },
  { value: FolderView.GALLERY, label: 'Gallery', Icon: ViewCarouselOutlined },
];

// Each keystroke would be a gateway call; the gateway allows 100 a minute.
const SEARCH_DEBOUNCE_MS = 300;
// What the gateway accepts.
const SEARCH_MAX_LENGTH = 255;

/**
 * The name search within this folder, the type filter, sort field and direction, the item count,
 * and the view switch. Folders always sort first.
 */
export const FolderToolbar: FC<Props> = ({ params, total, onChange }) => {
  const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null);
  const [typeAnchor, setTypeAnchor] = useState<HTMLElement | null>(null);
  const [search, setSearch] = useState(params.search ?? '');
  const isAsc = params.sortOrder === BrowserCommon.Sort.asc;
  const isFiltered = !!params.search || !!params.types.length;

  // The URL moved on its own — another folder, Back, "Clear filters": the field follows it.
  useEffect(() => {
    setSearch((current) =>
      current.trim() === (params.search ?? '') ? current : (params.search ?? ''),
    );
  }, [params.search]);

  useEffect(() => {
    const value = search.trim();

    if (value === (params.search ?? '')) {
      return;
    }

    const timer = setTimeout(
      () => onChange({ search: value || undefined, item: undefined }, 'replace'),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [search, params.search, onChange]);

  const toggleType = (type: BrowserStorage.StorageObjectType) =>
    onChange({
      types: params.types.includes(type)
        ? params.types.filter((selected) => selected !== type)
        : [...params.types, type],
      item: undefined,
    });

  const typeLabel = params.types.length
    ? params.types.map((type) => TYPE_LABELS[type]).join(', ')
    : 'Type';

  return (
    <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
      <TextField
        size="small"
        placeholder="Search in this folder"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onKeyDown={(event) => event.key === 'Escape' && setSearch('')}
        slotProps={{
          htmlInput: { maxLength: SEARCH_MAX_LENGTH, 'aria-label': 'Search in this folder' },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchRounded fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: search && (
              <InputAdornment position="end">
                <IconButton size="small" aria-label="Clear search" onClick={() => setSearch('')}>
                  <ClearRounded fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
        sx={{ width: { xs: 1, sm: 260 } }}
      />

      <Button
        size="small"
        color={params.types.length ? 'primary' : 'inherit'}
        startIcon={<FilterListRounded />}
        onClick={(event) => setTypeAnchor(event.currentTarget)}
        aria-haspopup="menu"
        sx={{ textTransform: 'none', maxWidth: 240 }}
      >
        <Typography variant="inherit" noWrap>
          {typeLabel}
        </Typography>
      </Button>
      <Menu anchorEl={typeAnchor} open={!!typeAnchor} onClose={() => setTypeAnchor(null)}>
        {Object.values(BrowserStorage.StorageObjectType).map((type) => (
          <MenuItem key={type} onClick={() => toggleType(type)} dense>
            <Checkbox
              size="small"
              edge="start"
              disableRipple
              tabIndex={-1}
              checked={params.types.includes(type)}
              sx={{ py: 0 }}
            />
            <ListItemIcon>
              <StorageItemIcon kind={getStorageItemKind({ type })} fontSize="small" />
            </ListItemIcon>
            <ListItemText>{TYPE_LABELS[type]}</ListItemText>
          </MenuItem>
        ))}
        <Divider />
        <MenuItem
          dense
          disabled={!params.types.length}
          onClick={() => {
            setTypeAnchor(null);
            onChange({ types: [], item: undefined });
          }}
        >
          <ListItemText inset>Clear</ListItemText>
        </MenuItem>
      </Menu>

      <Button
        size="small"
        color="inherit"
        startIcon={<SortRounded />}
        onClick={(event) => setSortAnchor(event.currentTarget)}
        aria-haspopup="menu"
        sx={{ textTransform: 'none' }}
      >
        {SORT_LABELS[params.sortBy]}
      </Button>
      <Tooltip title={isAsc ? 'Ascending' : 'Descending'}>
        <IconButton
          size="small"
          aria-label="Reverse sort order"
          onClick={() =>
            onChange({ sortOrder: isAsc ? BrowserCommon.Sort.desc : BrowserCommon.Sort.asc })
          }
        >
          {isAsc ? (
            <ArrowUpwardRounded fontSize="small" />
          ) : (
            <ArrowDownwardRounded fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
      <Menu anchorEl={sortAnchor} open={!!sortAnchor} onClose={() => setSortAnchor(null)}>
        {Object.values(BrowserStorage.StorageObjectSortField).map((field) => (
          <MenuItem
            key={field}
            selected={field === params.sortBy}
            onClick={() => {
              setSortAnchor(null);
              onChange({ sortBy: field });
            }}
          >
            <ListItemIcon>
              {field === params.sortBy && <CheckRounded fontSize="small" />}
            </ListItemIcon>
            <ListItemText>{SORT_LABELS[field]}</ListItemText>
          </MenuItem>
        ))}
      </Menu>

      {total !== undefined && (
        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
          {total}{' '}
          {isFiltered ? (total === 1 ? 'result' : 'results') : total === 1 ? 'item' : 'items'}
        </Typography>
      )}

      <ToggleButtonGroup
        exclusive
        size="small"
        value={params.view}
        onChange={(_, view: FolderView | null) => view && onChange({ view })}
        aria-label="View"
        sx={{ ml: 'auto' }}
      >
        {VIEWS.map(({ value, label, Icon }) => (
          <Tooltip key={value} title={label}>
            <ToggleButton value={value} aria-label={label}>
              <Icon fontSize="small" />
            </ToggleButton>
          </Tooltip>
        ))}
      </ToggleButtonGroup>
    </Stack>
  );
};
