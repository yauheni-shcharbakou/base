'use client';

import { pathProvider } from '@/common/providers';
import {
  FOLDER_PAGE_SIZES,
  FolderPreferences,
  FolderView,
  getChildOnPath,
  getFolderItemTarget,
} from '@/features/storage/helpers';
import { useDeleteStorageObject, useFolderContent } from '@/features/storage/hooks';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import SearchOffRounded from '@mui/icons-material/SearchOffRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  LinearProgress,
  Skeleton,
  Stack,
  TablePagination,
  Typography,
} from '@mui/material';
import { Database, StorageDatabaseEntity } from '@packages/common';
import type { BrowserStorage } from '@packages/proto';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import React, { FC, useCallback, useState } from 'react';
import { DeleteStorageItemDialog } from './delete-storage-item-dialog';
import { FolderBreadcrumbs } from './folder-breadcrumbs';
import { FolderGalleryView } from './folder-gallery-view';
import { FolderGridView } from './folder-grid-view';
import { FolderListView } from './folder-list-view';
import { FolderToolbar } from './folder-toolbar';
import { isTyping, useWindowKeyDown } from './use-window-key-down';

type Item = BrowserStorage.StorageObjectFolderItem;

type Props = {
  folderId: string;
  // The viewer's saved view and sort, read from their cookie on the server.
  preferences: FolderPreferences;
};

const { STORAGE } = Database;
const { STORAGE_OBJECT } = StorageDatabaseEntity;

const LoadingGrid: FC = () => (
  <Box
    sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}
  >
    {Array.from({ length: 8 }, (_, index) => (
      <Skeleton key={index} variant="rounded" height={180} />
    ))}
  </Box>
);

const EmptyFolder: FC<{ onClearFilters?: () => void }> = ({ onClearFilters }) => (
  <Stack alignItems="center" gap={1} sx={{ py: 8, color: 'text.secondary' }}>
    {onClearFilters ? (
      <>
        <SearchOffRounded sx={{ fontSize: 72 }} />
        <Typography>No items match</Typography>
        <Button onClick={onClearFilters}>Clear filters</Button>
      </>
    ) : (
      <>
        <FolderOpenOutlined sx={{ fontSize: 72 }} />
        <Typography>This folder is empty</Typography>
      </>
    )}
  </Stack>
);

/**
 * A folder of a user's storage, browsed the way Google Drive does — grid or list — or the way
 * Finder's gallery does. A folder opens in place; a file, image or video opens in a new tab once
 * its upload is done, and its details otherwise.
 */
export const FolderBrowser: FC<Props> = ({ folderId, preferences: initialPreferences }) => {
  const router = useRouter();
  const {
    params,
    setParams,
    preferences,
    setGalleryInfo,
    getFolderHref,
    getAncestorHref,
    markItem,
    content,
    error,
    isPending,
    isFetching,
    isPlaceholderData,
    pageCount,
    refreshPreviews,
    prefetchPage,
  } = useFolderContent(folderId, initialPreferences);
  const deletion = useDeleteStorageObject();
  const [pendingDelete, setPendingDelete] = useState<Item>();

  const openItem = useCallback(
    (item: Item) => {
      const target = getFolderItemTarget(item);

      if (target.kind === 'folder') {
        // Back comes to this page with the folder marked.
        markItem(item.id);
        router.push(getFolderHref(item.id));
      } else if (target.kind === 'external') {
        window.open(target.href, '_blank', 'noopener');
      } else {
        router.push(target.href);
      }
    },
    [router, getFolderHref, markItem],
  );

  const ancestors = content?.ancestors;

  // An ancestor with the folder that leads back down marked, on the page it was left on.
  const getAncestorLink = useCallback(
    (id: string) => getAncestorHref(id, getChildOnPath(ancestors ?? [], folderId, id)),
    [getAncestorHref, ancestors, folderId],
  );

  const parent = ancestors?.[ancestors.length - 1];

  const openParent = useCallback(() => {
    if (parent) {
      router.push(getAncestorLink(parent.id));
    }
  }, [router, getAncestorLink, parent]);

  // Finder's ⌘↑ (a bare Backspace too), in every view and in an empty folder. ⌘⌫ is a delete.
  useWindowKeyDown((event) => {
    const isUp = event.key === 'ArrowUp' && (event.metaKey || event.ctrlKey);
    const isBack = event.key === 'Backspace' && !event.metaKey && !event.ctrlKey && !event.altKey;

    if ((isUp || isBack) && !event.defaultPrevented && !isTyping(event.target)) {
      event.preventDefault();
      openParent();
    }
  });

  const selectItem = useCallback((id: string) => setParams({ item: id }, 'replace'), [setParams]);

  const changePage = useCallback(
    (page: number) => setParams({ page, item: undefined }, 'replace'),
    [setParams],
  );

  const confirmDelete = (item: Item) =>
    deletion.mutate(item, { onSettled: () => setPendingDelete(undefined) });

  const isFiltered = !!params.search || !!params.types.length;

  const renderView = (items: Item[]) => {
    if (!items.length) {
      return (
        <EmptyFolder
          onClearFilters={
            isFiltered ? () => setParams({ search: undefined, types: [] }, 'replace') : undefined
          }
        />
      );
    }

    switch (params.view) {
      case FolderView.LIST:
        return (
          <FolderListView
            items={items}
            selectedId={params.item}
            params={params}
            onSortChange={(sortBy, sortOrder) => setParams({ sortBy, sortOrder })}
            onOpen={openItem}
            onDelete={setPendingDelete}
            getFolderHref={getFolderHref}
          />
        );
      case FolderView.GALLERY:
        return (
          <FolderGalleryView
            items={items}
            isPlaceholderData={isPlaceholderData}
            selectedId={params.item}
            page={params.page}
            pageCount={pageCount}
            pageSize={params.pageSize}
            total={content?.total ?? 0}
            isInfoShown={preferences.galleryInfo}
            onInfoShownChange={setGalleryInfo}
            onSelect={selectItem}
            onPageChange={changePage}
            onPrefetch={prefetchPage}
            onOpen={openItem}
            onDelete={setPendingDelete}
            onPreviewError={refreshPreviews}
            getFolderHref={getFolderHref}
          />
        );
      default:
        return (
          <FolderGridView
            items={items}
            selectedId={params.item}
            onOpen={openItem}
            onDelete={setPendingDelete}
            onPreviewError={refreshPreviews}
            getFolderHref={getFolderHref}
          />
        );
    }
  };

  if (error && !content) {
    const isNotFound = (error as { statusCode?: number }).statusCode === 404;

    return (
      <Card>
        <CardContent>
          <Stack gap={2} alignItems="flex-start">
            <Alert severity="error" sx={{ alignSelf: 'stretch' }}>
              {isNotFound ? 'This folder does not exist, or is not a folder.' : error.message}
            </Alert>
            <Button component={NextLink} href={pathProvider.getListPath(STORAGE, STORAGE_OBJECT)}>
              Back to storage objects
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ position: 'relative' }}>
      {isFetching && !isPending && (
        <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
      )}
      <CardHeader
        disableTypography
        title={
          content ? (
            <FolderBreadcrumbs
              folder={content.folder}
              ancestors={content.ancestors}
              getAncestorHref={getAncestorLink}
            />
          ) : (
            <Skeleton width={240} height={32} />
          )
        }
        action={
          <Button
            size="small"
            startIcon={<InfoOutlined />}
            component={NextLink}
            href={pathProvider.getShowPath(STORAGE, STORAGE_OBJECT, folderId)}
          >
            Details
          </Button>
        }
      />
      <Box sx={{ px: 2, pb: 1 }}>
        <FolderToolbar params={params} total={content?.total} onChange={setParams} />
      </Box>
      <Divider />
      <CardContent>{content ? renderView(content.items) : <LoadingGrid />}</CardContent>
      {!!content?.total && (
        <>
          <Divider />
          <TablePagination
            component="div"
            count={content.total}
            page={Math.min(params.page, pageCount) - 1}
            rowsPerPage={params.pageSize}
            rowsPerPageOptions={FOLDER_PAGE_SIZES}
            onPageChange={(_, page) => setParams({ page: page + 1, item: undefined })}
            onRowsPerPageChange={(event) =>
              setParams({ pageSize: Number(event.target.value), item: undefined })
            }
          />
        </>
      )}
      <DeleteStorageItemDialog
        item={pendingDelete}
        isDeleting={deletion.isPending}
        onCancel={() => setPendingDelete(undefined)}
        onConfirm={confirmDelete}
      />
    </Card>
  );
};
