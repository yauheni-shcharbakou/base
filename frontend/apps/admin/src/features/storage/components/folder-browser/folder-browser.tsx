'use client';

import { pathProvider } from '@/common/providers';
import {
  Direction,
  FOLDER_PAGE_SIZES,
  FolderPreferences,
  FolderView,
  getChildOnPath,
  getFolderItemTarget,
  StorageBatchError,
} from '@/features/storage/helpers';
import {
  ITEM_ID_ATTRIBUTE,
  readItemRects,
  useDeleteStorageObjects,
  useFolderContent,
  useFolderSelection,
  useMarqueeSelection,
  useMoveStorageObjects,
  useRootFolderLabel,
} from '@/features/storage/hooks';
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined';
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
  Paper,
  Skeleton,
  Stack,
  TablePagination,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Database, StorageDatabaseEntity } from '@packages/common';
import type { BrowserStorage } from '@packages/proto';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import React, { FC, useCallback, useRef, useState } from 'react';
import { DeleteStorageItemDialog } from './delete-storage-item-dialog';
import { FolderBreadcrumbs } from './folder-breadcrumbs';
import { FolderGalleryView } from './folder-gallery-view';
import { FolderGridView } from './folder-grid-view';
import { FolderListView } from './folder-list-view';
import { FolderNewMenu } from './folder-new-menu';
import { FolderSelectionBar } from './folder-selection-bar';
import { FolderToolbar } from './folder-toolbar';
import { MoveStorageItemsDialog } from './move-storage-items-dialog';
import { useFileDrop } from './use-file-drop';
import { DropFolder, FolderItemBehavior, useFolderItemBehavior } from './use-folder-item-behavior';
import { isControl, isTyping, useWindowKeyDown } from './use-window-key-down';

type Item = BrowserStorage.StorageObjectFolderItem;

type Props = {
  folderId: string;
  // The viewer's saved view and sort, read from their cookie on the server.
  preferences: FolderPreferences;
};

const { STORAGE } = Database;
const { STORAGE_OBJECT } = StorageDatabaseEntity;

const DIRECTION_BY_KEY: Partial<Record<string, Direction>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

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
 * its upload is done, and its details otherwise. In the grid and the list a click selects, as in
 * Drive, and the selection moves or deletes together — from its bar, an item's "⋮", a drag onto a
 * folder or a breadcrumb, or the keyboard. Files dropped from the desktop upload into the folder, or
 * into the subfolder or breadcrumb they land on.
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
  const deletion = useDeleteStorageObjects();
  const moving = useMoveStorageObjects();
  const [pendingDelete, setPendingDelete] = useState<Item[]>();
  const [pendingMove, setPendingMove] = useState<Item[]>();
  const contentRef = useRef<HTMLDivElement>(null);
  const isGallery = params.view === FolderView.GALLERY;
  const rootLabel = useRootFolderLabel(content?.folder.userId);
  const shownFolder = content && { id: folderId, name: content.folder.name || rootLabel };
  const fileDrop = useFileDrop({ userId: content?.folder.userId, folder: shownFolder });

  const selection = useFolderSelection({
    items: content?.items,
    // A new folder or filter starts a new selection, and so does the gallery, which has its own.
    // Another page, order, or Drive's other view keeps it.
    resetKey: [folderId, isGallery, params.search ?? '', params.types.join(',')].join('|'),
    initialFocus: params.focus,
    onFocusChange: useCallback((id?: string) => setParams({ focus: id }, 'replace'), [setParams]),
  });

  const marquee = useMarqueeSelection(contentRef, {
    selectedIds: selection.selectedIds,
    onSelect: selection.setIds,
    onClear: selection.clear,
  });

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

  const selectItem = useCallback((id: string) => setParams({ focus: id }, 'replace'), [setParams]);

  const changePage = useCallback(
    (page: number) => setParams({ page, focus: undefined }, 'replace'),
    [setParams],
  );

  // What Move and Delete on an item act on: the whole selection when the item is part of it.
  const getActionItems = (item: Item) =>
    selection.selectedIds.has(item.id) && selection.selectedItems.length > 1
      ? selection.selectedItems
      : [item];

  // What went through leaves the selection, whether the whole run did or only its first batches.
  const dropDone = (items: Item[], error: unknown) => {
    const done = error instanceof StorageBatchError ? (error.done as Item[]) : error ? [] : items;
    selection.remove(done.map(({ id }) => id));
  };

  const move = (items: Item[], target: DropFolder) =>
    moving.mutate(
      { items, target },
      {
        onSettled: (_, error) => {
          setPendingMove(undefined);
          dropDone(items, error);
        },
      },
    );

  const confirmDelete = (items: Item[]) =>
    deletion.mutate(items, {
      onSettled: (_, error) => {
        setPendingDelete(undefined);
        dropDone(items, error);
      },
    });

  // Out of the gallery, its item is no selection: the grid and the list start with none.
  const changeParams = useCallback(
    (patch: Parameters<typeof setParams>[0]) =>
      setParams(
        isGallery && patch.view && patch.view !== FolderView.GALLERY
          ? { ...patch, focus: undefined }
          : patch,
      ),
    [setParams, isGallery],
  );

  const itemBehavior = useFolderItemBehavior({
    selectedItems: selection.selectedItems,
    selectedIds: selection.selectedIds,
    onClick: selection.click,
    onOpen: openItem,
    onDragStart: selection.ensureSelected,
    onDrop: move,
    onFilesDrop: fileDrop.uploadDropped,
  });

  const behavior: FolderItemBehavior = {
    ...itemBehavior,
    selectedIds: selection.selectedIds,
    focusedId: selection.focusedId,
    onToggle: selection.toggle,
    menu: {
      getFolderHref,
      onMenuOpen: selection.ensureSelected,
      onMove: (item) => setPendingMove(getActionItems(item)),
      onDelete: (item) => setPendingDelete(getActionItems(item)),
      getActionCount: (item) => getActionItems(item).length,
    },
  };

  // Drive's keys over the grid and the list; the gallery has its own. A dialog keeps its keys.
  useWindowKeyDown((event) => {
    if (
      isGallery ||
      !content ||
      pendingDelete ||
      pendingMove ||
      event.defaultPrevented ||
      isTyping(event.target)
    ) {
      return;
    }

    const isModified = event.metaKey || event.ctrlKey;
    const direction = DIRECTION_BY_KEY[event.key];
    const { selectedItems } = selection;

    if (direction) {
      // ⌘↑ is up to the parent; ⌘↓ opens, as in Finder.
      if (isModified) {
        const focused = content.items.find(({ id }) => id === selection.focusedId);

        if (direction === 'down' && focused) {
          event.preventDefault();
          openItem(focused);
        }

        return;
      }

      if (selection.step(readItemRects(contentRef.current), direction, event.shiftKey)) {
        event.preventDefault();
      }

      return;
    }

    switch (event.key) {
      case 'a':
      case 'A':
        if (isModified && !event.altKey) {
          event.preventDefault();
          selection.selectAll();
        }
        break;
      case 'Escape':
        if (selectedItems.length) {
          event.preventDefault();
          selection.clear();
        }
        break;
      case 'Delete':
      case 'Backspace':
        // A bare Backspace is up to the parent.
        if ((event.key === 'Delete' || isModified) && selectedItems.length) {
          event.preventDefault();
          setPendingDelete(selectedItems);
        }
        break;
      case 'Enter': {
        const target = event.target as HTMLElement;
        const itemElement = target.closest?.(`[${ITEM_ID_ATTRIBUTE}]`);

        // A control inside an item — its "⋮", its checkbox — presses itself.
        if (isControl(target) && target !== itemElement) {
          return;
        }

        const id = itemElement?.getAttribute(ITEM_ID_ATTRIBUTE) ?? selection.focusedId;
        const item = content.items.find((candidate) => candidate.id === id);

        if (item) {
          event.preventDefault();
          openItem(item);
        }
        break;
      }
    }
  });

  const isSelecting = !isGallery && !!selection.selectedItems.length;
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
            behavior={behavior}
            params={params}
            onSortChange={(sortBy, sortOrder) => setParams({ sortBy, sortOrder })}
            onToggleAll={selection.toggleAll}
          />
        );
      case FolderView.GALLERY:
        return (
          <FolderGalleryView
            items={items}
            isPlaceholderData={isPlaceholderData}
            selectedId={params.focus}
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
            onDelete={(item) => setPendingDelete([item])}
            onPreviewError={refreshPreviews}
            getFolderHref={getFolderHref}
          />
        );
      default:
        return (
          <FolderGridView items={items} behavior={behavior} onPreviewError={refreshPreviews} />
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

  const fileDropTarget = fileDrop.isOver ? (behavior.dropTarget ?? shownFolder) : undefined;

  return (
    <Card {...fileDrop.zoneProps} sx={{ position: 'relative' }}>
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
              getDropProps={behavior.getDropProps}
              dropTargetId={behavior.dropTargetId}
            />
          ) : (
            <Skeleton width={240} height={32} />
          )
        }
        action={
          <Stack direction="row" gap={1}>
            {content && shownFolder && (
              <FolderNewMenu
                folderId={folderId}
                userId={content.folder.userId}
                onUpload={(files) => fileDrop.upload(files, shownFolder)}
              />
            )}
            <Button
              size="small"
              startIcon={<InfoOutlined />}
              component={NextLink}
              href={pathProvider.getShowPath(STORAGE, STORAGE_OBJECT, folderId)}
            >
              Details
            </Button>
          </Stack>
        }
      />
      {/* The selection bar lies over the toolbar, which keeps its place: the items below never
          jump as a selection starts or ends, and a search being typed survives it. */}
      <Box sx={{ position: 'relative', px: 2, pb: 1 }}>
        <Box sx={{ visibility: isSelecting ? 'hidden' : undefined }}>
          <FolderToolbar params={params} total={content?.total} onChange={changeParams} />
        </Box>
        {isSelecting && (
          <Box sx={{ position: 'absolute', top: 0, left: 16, right: 16 }}>
            <FolderSelectionBar
              count={selection.selectedItems.length}
              onClear={selection.clear}
              onMove={() => setPendingMove(selection.selectedItems)}
              onDelete={() => setPendingDelete(selection.selectedItems)}
            />
          </Box>
        )}
      </Box>
      <Divider />
      <CardContent
        ref={contentRef}
        {...(isGallery ? {} : marquee.handlers)}
        sx={{ position: 'relative', minHeight: 240 }}
      >
        {content ? renderView(content.items) : <LoadingGrid />}
        {marquee.box && (
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              left: marquee.box.left,
              top: marquee.box.top,
              width: marquee.box.right - marquee.box.left,
              height: marquee.box.bottom - marquee.box.top,
              border: 1,
              borderColor: 'primary.main',
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
              pointerEvents: 'none',
            }}
          />
        )}
      </CardContent>
      {!!content?.total && (
        <>
          <Divider />
          <TablePagination
            component="div"
            count={content.total}
            page={Math.min(params.page, pageCount) - 1}
            rowsPerPage={params.pageSize}
            rowsPerPageOptions={FOLDER_PAGE_SIZES}
            onPageChange={(_, page) => setParams({ page: page + 1, focus: undefined })}
            onRowsPerPageChange={(event) =>
              setParams({ pageSize: Number(event.target.value), focus: undefined })
            }
          />
        </>
      )}
      <DeleteStorageItemDialog
        items={pendingDelete}
        isDeleting={deletion.isPending}
        onCancel={() => setPendingDelete(undefined)}
        onConfirm={confirmDelete}
      />
      {fileDropTarget && (
        // Drive's drop area: the folder outlined, and where the files are going.
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            border: 2,
            borderColor: 'primary.main',
            borderRadius: 1,
            bgcolor: (theme) => alpha(theme.palette.primary.main, behavior.dropTarget ? 0 : 0.04),
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          <Paper
            elevation={6}
            sx={{
              position: 'fixed',
              left: '50%',
              bottom: 'calc(32px + env(safe-area-inset-bottom, 0px))',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 1,
              maxWidth: 'calc(100vw - 32px)',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
            }}
          >
            <CloudUploadOutlined />
            <Typography variant="body2" noWrap>
              Drop files to upload them to “{fileDropTarget.name}”
            </Typography>
          </Paper>
        </Box>
      )}
      {content && (
        <MoveStorageItemsDialog
          items={pendingMove}
          folder={content.folder}
          isMoving={moving.isPending}
          onCancel={() => setPendingMove(undefined)}
          onConfirm={move}
        />
      )}
    </Card>
  );
};
