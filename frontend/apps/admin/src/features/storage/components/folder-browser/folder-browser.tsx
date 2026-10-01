'use client';

import { useReplacingNotification } from '@/common/hooks';
import { pathProvider } from '@/common/providers';
import {
  Direction,
  FOLDER_PAGE_SIZES,
  FolderPreferences,
  FolderView,
  formatFolderStats,
  getChildOnPath,
  getFolderItemTarget,
  getShortcutKey,
  MAX_SELECTION,
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
  useSetStorageObjectsPublic,
} from '@/features/storage/hooks';
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';
import SearchOffRounded from '@mui/icons-material/SearchOffRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
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
import React, { FC, useCallback, useEffect, useRef, useState } from 'react';
import { MenuPosition, openOwnMenu } from './context-menu';
import { CreateFolderDialog } from './create-folder-dialog';
import { DeleteStorageItemDialog } from './delete-storage-item-dialog';
import { FolderBreadcrumbs } from './folder-breadcrumbs';
import { FolderGalleryView } from './folder-gallery-view';
import { FolderGridView } from './folder-grid-view';
import { FolderListView } from './folder-list-view';
import { FolderNewMenu } from './folder-new-menu';
import { FolderSelectionBar } from './folder-selection-bar';
import { FolderToolbar } from './folder-toolbar';
import { GalleryViewer } from './gallery-viewer';
import { MoveStorageItemsDialog } from './move-storage-items-dialog';
import { RenameStorageItemDialog } from './rename-storage-item-dialog';
import { StorageItemActionsMenu } from './storage-item-menu';
import { useFileDrop } from './use-file-drop';
import { DropFolder, FolderItemBehavior, useFolderItemBehavior } from './use-folder-item-behavior';
import { useFolderViewer } from './use-folder-viewer';
import { useUploadAgain } from './use-upload-again';
import { isControl, isTyping, useWindowKeyDown } from './use-window-key-down';

type Item = BrowserStorage.StorageObjectFolderItem;

type Props = {
  folderId: string;
  // The viewer's saved view and sort, read from their cookie on the server.
  preferences: FolderPreferences;
};

const { STORAGE } = Database;
const { STORAGE_OBJECT } = StorageDatabaseEntity;

// One array for every render without a listing: an effect that depends on the items must not rerun.
const NO_ITEMS: Item[] = [];

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
 * Finder's gallery does. A folder opens in place; anything else in the full-screen viewer, which
 * steps through the folder's files — through all its items, from the gallery — and opens one in a
 * new tab once its upload is done, and says what the upload is at before that — a failed one is
 * uploaded again or deleted there. In the grid and the list a click selects, as in
 * Drive, and the selection — up to 100 items — moves, deletes or turns public or private together:
 * from its bar, an item's "⋮", a drag onto a folder or a breadcrumb, or the keyboard. An item's "⋮"
 * renames it. Files dropped from the desktop upload into the folder, or
 * into the subfolder or breadcrumb they land on; "New" makes a folder in it, or picks what to upload.
 * A right click opens, by the pointer, an item's "⋮" — or "New", on the empty space around the items.
 * A failed upload's "Upload again" is in that "⋮" too.
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
  const publicity = useSetStorageObjectsPublic();
  const notify = useReplacingNotification();
  const [pendingDelete, setPendingDelete] = useState<Item[]>();
  const [pendingMove, setPendingMove] = useState<Item[]>();
  const [pendingRename, setPendingRename] = useState<Item>();
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  // Drive's right click, one menu at a time: an item's own by the pointer — or, on the folder's
  // empty space, "New". Shut, it keeps what it showed while it fades.
  const [contextMenu, setContextMenu] = useState<{
    position: MenuPosition;
    item?: Item;
    isOpen: boolean;
  }>();
  const contentRef = useRef<HTMLDivElement>(null);
  const isGallery = params.view === FolderView.GALLERY;
  const rootLabel = useRootFolderLabel(content?.folder.userId);
  const shownFolder = content && { id: folderId, name: content.folder.name || rootLabel };
  const fileDrop = useFileDrop({ userId: content?.folder.userId, folder: shownFolder });

  const selectItem = useCallback((id: string) => setParams({ focus: id }, 'replace'), [setParams]);

  // Over the grid and the list the viewer keeps its own item, off the selection: stepping through
  // files must neither select them nor move the keyboard's item under it, until it is left.
  const [viewerId, setViewerId] = useState<string>();

  // A failed upload's way out, from the stage that tells of it: a new file in its place. The page
  // every view shows is its `items` — the listing's, with the item being replaced held on it until
  // the new one is listed, which is then shown where the old one was.
  const reupload = useUploadAgain({
    userId: content?.folder.userId,
    folder: shownFolder,
    items: content?.items ?? NO_ITEMS,
    scope: [
      folderId,
      params.page,
      params.pageSize,
      params.sortBy,
      params.sortOrder,
      params.search ?? '',
      params.types.join(','),
    ].join('|'),
    currentId: isGallery ? params.focus : viewerId,
    onShow: isGallery ? selectItem : setViewerId,
  });
  const { items, heldId } = reupload;

  // The held item is deleted already: no rename, move, delete or visibility change takes it along,
  // from its "⋮" (which rests), a key, or a selection it is part of.
  const withoutHeld = (acted: Item[]) => acted.filter(({ id }) => id !== heldId);

  const askRename = (item: Item) => {
    if (item.id !== heldId) {
      setPendingRename(item);
    }
  };

  const askDelete = (acted: Item[]) => {
    const left = withoutHeld(acted);

    if (left.length) {
      setPendingDelete(left);
    }
  };

  const askMove = (acted: Item[]) => {
    const left = withoutHeld(acted);

    if (left.length) {
      setPendingMove(left);
    }
  };

  const selection = useFolderSelection({
    items: content ? items : undefined,
    // A new folder or filter starts a new selection, and so does the gallery, which has its own.
    // Another page, order, or Drive's other view keeps it.
    resetKey: [folderId, isGallery, params.search ?? '', params.types.join(',')].join('|'),
    initialFocus: params.focus,
    onFocusChange: useCallback((id?: string) => setParams({ focus: id }, 'replace'), [setParams]),
    // Every action on a selection is one gateway call, which takes no more.
    onLimit: useCallback(
      () =>
        notify({
          type: 'error',
          message: `You can select up to ${MAX_SELECTION} items`,
          key: 'storage-selection-limit',
        }),
      [notify],
    ),
  });

  const { selectedIds, remove: deselect } = selection;
  const lastHeldId = useRef<string>(undefined);

  // Let go — swapped for the new item, or dropped — the held item is gone for good: it leaves the
  // selection, which would otherwise carry a deleted item into the next move or delete.
  useEffect(() => {
    const gone = lastHeldId.current;
    lastHeldId.current = heldId;

    if (gone && gone !== heldId && selectedIds.has(gone)) {
      deselect([gone]);
    }
  }, [heldId, selectedIds, deselect]);

  const marquee = useMarqueeSelection(contentRef, {
    selectedIds: selection.selectedIds,
    onSelect: selection.setIds,
    onClear: selection.clear,
  });

  // The item itself: a folder in place, the rest in a new tab — and nothing before its upload is
  // done, when the viewer says why instead. What the viewer's and the gallery's Open buttons do.
  const openExternal = useCallback(
    (item: Item) => {
      const target = getFolderItemTarget(item);

      if (target.kind === 'folder') {
        // Back comes to this page with the folder marked.
        markItem(item.id);
        router.push(getFolderHref(item.id));
      } else if (target.kind === 'external') {
        window.open(target.href, '_blank', 'noopener');
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

    if ((isUp || isBack) && !viewer.isOpen && !event.defaultPrevented && !isTyping(event.target)) {
      event.preventDefault();
      openParent();
    }
  });

  // Drive's Shift+F, in every view: a new folder here.
  useWindowKeyDown((event) => {
    const isNewFolder =
      getShortcutKey(event) === 'f' &&
      event.shiftKey &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey;

    if (
      isNewFolder &&
      content &&
      !viewer.isOpen &&
      !pendingDelete &&
      !pendingMove &&
      !pendingRename &&
      !isCreatingFolder &&
      !event.defaultPrevented &&
      !isTyping(event.target)
    ) {
      event.preventDefault();
      setIsCreatingFolder(true);
    }
  });

  const changePage = useCallback(
    (page: number) => setParams({ page, focus: undefined }, 'replace'),
    [setParams],
  );

  const viewer = useFolderViewer({
    items,
    isPlaceholderData,
    page: params.page,
    pageCount,
    pageSize: params.pageSize,
    total: (content?.total ?? 0) + reupload.heldCount,
    folderTotal: content?.folderTotal ?? 0,
    currentId: isGallery ? params.focus : viewerId,
    onCurrentChange: isGallery ? selectItem : setViewerId,
    onPageChange: changePage,
    onPrefetch: prefetchPage,
    isFilesOnly: !isGallery,
    onOpen: openExternal,
    onRename: askRename,
    onDelete: (item) => askDelete([item]),
    onToggleInfo: () => setGalleryInfo(!preferences.galleryInfo),
    // Left from the grid or the list, the item last shown is selected, as in Drive.
    onExit: (item) => !isGallery && item && selection.click(item, {}),
  });

  const { open: openViewer } = viewer;

  // A double click or Enter: a folder in place, anything else in the viewer.
  const openItem = useCallback(
    (item: Item) =>
      getFolderItemTarget(item).kind === 'folder' ? openExternal(item) : openViewer(item.id),
    [openExternal, openViewer],
  );

  // What Move, Delete and Public on an item act on: the whole selection when the item is part of it.
  const getActionItems = (item: Item) =>
    selection.selectedIds.has(item.id) && selection.selectedItems.length > 1
      ? selection.selectedItems
      : [item];

  // What went through leaves the selection — a call is all or none.
  const dropDone = (items: Item[], error: unknown) => {
    if (!error) {
      selection.remove(items.map(({ id }) => id));
    }
  };

  // Nothing in a public folder goes private: the service refuses it, and the admin offers it not.
  const isPublicLocked = !!content?.folder.isPublic;

  const setPublic = (acted: Item[], isPublic: boolean) => {
    const items = withoutHeld(acted);

    if (items.length) {
      publicity.mutate({ items, isPublic });
    }
  };

  // From the dialog, or a drag onto a folder or a breadcrumb.
  const move = (acted: Item[], target: DropFolder) => {
    const items = withoutHeld(acted);

    if (!items.length) {
      setPendingMove(undefined);
      return;
    }

    moving.mutate(
      { items, target },
      {
        onSettled: (_, error) => {
          setPendingMove(undefined);
          dropDone(items, error);
        },
      },
    );
  };

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

  const closeContextMenu = () => setContextMenu((menu) => menu && { ...menu, isOpen: false });

  // The item becomes the selection unless it is part of it, as its "⋮" makes it — the gallery's one
  // selected item, in its strip. The held item is deleted already: it has no menu, as its "⋮" rests.
  const openItemMenu = (item: Item, position: MenuPosition) => {
    if (item.id === heldId) {
      return;
    }

    if (isGallery) {
      selectItem(item.id);
    } else {
      selection.ensureSelected(item);
    }

    setContextMenu({ position, item, isOpen: true });
  };

  // On the empty space around the items, which a click clears the selection from.
  const openFolderMenu = openOwnMenu((position) => {
    selection.clear();
    setContextMenu({ position, isOpen: true });
  });

  const itemBehavior = useFolderItemBehavior({
    selectedItems: selection.selectedItems,
    selectedIds: selection.selectedIds,
    onClick: selection.click,
    onOpen: openItem,
    onContextMenu: openItemMenu,
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
      onMove: (item) => askMove(getActionItems(item)),
      onDelete: (item) => askDelete(getActionItems(item)),
      onRename: askRename,
      onUploadAgain: reupload.uploadAgain,
      onPublicChange: (item, isPublic) => setPublic(getActionItems(item), isPublic),
      getActionCount: (item) => getActionItems(item).length,
      getActionsPublic: (item) => getActionItems(item).every((action) => action.isPublic),
      isPublicLocked,
    },
  };

  // Drive's keys over the grid and the list; the gallery has its own, and so has the viewer over
  // them. A dialog keeps its keys.
  useWindowKeyDown((event) => {
    if (
      isGallery ||
      viewer.isOpen ||
      !content ||
      pendingDelete ||
      pendingMove ||
      pendingRename ||
      isCreatingFolder ||
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
        const focused = items.find(({ id }) => id === selection.focusedId);

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

    // A letter by its key, whatever the layout types (`getShortcutKey`).
    switch (getShortcutKey(event)) {
      case 'a':
        if (isModified && !event.altKey) {
          event.preventDefault();
          selection.selectAll();
        }
        break;
      case 'F2': {
        // Drive's and Finder's rename: the one item selected, or the one the keyboard is on.
        const target =
          selectedItems.length === 1
            ? selectedItems[0]
            : selectedItems.length
              ? undefined
              : items.find(({ id }) => id === selection.focusedId);

        if (target) {
          event.preventDefault();
          askRename(target);
        }
        break;
      }
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
          askDelete(selectedItems);
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
        const item = items.find((candidate) => candidate.id === id);

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
            isInfoShown={preferences.galleryInfo}
            onInfoShownChange={setGalleryInfo}
            onSelect={selectItem}
            onOpen={openItem}
            onOpenExternal={openExternal}
            onUploadAgain={reupload.uploadAgain}
            onDelete={(item) => askDelete([item])}
            onMove={(item) => askMove([item])}
            onRename={askRename}
            onPublicChange={(item, isPublic) => setPublic([item], isPublic)}
            onContextMenu={openItemMenu}
            isPublicLocked={isPublicLocked}
            onPreviewError={refreshPreviews}
            getFolderHref={getFolderHref}
            viewer={viewer}
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
  const openMenuPosition = contextMenu?.isOpen ? contextMenu.position : undefined;
  // As listed now, where it still is: the menu's switch follows a change made meanwhile.
  const menuItem =
    contextMenu?.item && (items.find(({ id }) => id === contextMenu.item?.id) ?? contextMenu.item);
  // The gallery's stage keeps the browser's own menu — an image's, a player's — so only an empty
  // folder has "New" under the pointer there; its strip's items have their own.
  const hasFolderMenu = !!content && (!isGallery || !items.length);

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
        subheader={
          content?.folder.folderStats && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {formatFolderStats(content.folder.folderStats)}
            </Typography>
          )
        }
        action={
          content &&
          shownFolder && (
            <FolderNewMenu
              onCreateFolder={() => setIsCreatingFolder(true)}
              onUpload={(files) => fileDrop.uploadFiles(files, shownFolder)}
              onUploadFolder={(files) => fileDrop.uploadDirectory(files, shownFolder)}
              position={contextMenu?.item ? undefined : openMenuPosition}
              onPositionClose={closeContextMenu}
            />
          )
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
              onMove={() => askMove(selection.selectedItems)}
              onDelete={() => askDelete(selection.selectedItems)}
              onPublicChange={(isPublic) => setPublic(selection.selectedItems, isPublic)}
              isPublicLocked={isPublicLocked}
            />
          </Box>
        )}
      </Box>
      <Divider />
      <CardContent
        ref={contentRef}
        {...(isGallery ? {} : marquee.handlers)}
        onContextMenu={hasFolderMenu ? openFolderMenu : undefined}
        sx={{ position: 'relative', minHeight: 240 }}
      >
        {content ? renderView(items) : <LoadingGrid />}
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
      <RenameStorageItemDialog item={pendingRename} onClose={() => setPendingRename(undefined)} />
      {menuItem && (
        <StorageItemActionsMenu
          // Opened anew at every point: a right click beside it moves it, and its first entry
          // takes the focus again.
          key={`${menuItem.id}:${contextMenu?.position.left}:${contextMenu?.position.top}`}
          item={menuItem}
          anchorPosition={openMenuPosition}
          onClose={closeContextMenu}
          getFolderHref={behavior.menu.getFolderHref}
          onMove={behavior.menu.onMove}
          onDelete={behavior.menu.onDelete}
          onRename={behavior.menu.onRename}
          onUploadAgain={behavior.menu.onUploadAgain}
          onPublicChange={behavior.menu.onPublicChange}
          isPublic={behavior.menu.getActionsPublic(menuItem)}
          isPublicLocked={behavior.menu.isPublicLocked}
          actionCount={behavior.menu.getActionCount(menuItem)}
        />
      )}
      <GalleryViewer
        open={viewer.isOpen}
        item={viewer.current}
        startTime={viewer.startTime}
        position={viewer.overall}
        canPrev={viewer.canPrev}
        canNext={viewer.canNext}
        isInfoShown={preferences.galleryInfo}
        onPrev={() => viewer.step('prev')}
        onNext={() => viewer.step('next')}
        onExit={viewer.exit}
        onToggleInfo={() => setGalleryInfo(!preferences.galleryInfo)}
        onOpen={openExternal}
        onUploadAgain={reupload.uploadAgain}
        onDelete={(item) => askDelete([item])}
        onMove={(item) => askMove([item])}
        onRename={askRename}
        onPublicChange={(item, isPublic) => setPublic([item], isPublic)}
        isPublicLocked={isPublicLocked}
        onPreviewError={refreshPreviews}
        getFolderHref={getFolderHref}
        playerControls={viewer.playerControls}
        pdfControls={viewer.pdfControls}
      />
      <input {...reupload.inputProps} />
      {fileDropTarget && (
        // Drive's drop area: the folder outlined.
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
        />
      )}
      {(fileDropTarget || fileDrop.preparing) && (
        // Where the files are going, and then that their folders are being read and made.
        <Paper
          elevation={6}
          role="status"
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
            pointerEvents: 'none',
            zIndex: (theme) => theme.zIndex.snackbar,
          }}
        >
          {fileDropTarget ? (
            <CloudUploadOutlined />
          ) : (
            <CircularProgress size={20} color="inherit" />
          )}
          <Typography variant="body2" noWrap>
            {fileDropTarget
              ? `Drop files or folders to upload them to “${fileDropTarget.name}”`
              : `Preparing the upload to “${fileDrop.preparing?.name}”…`}
          </Typography>
        </Paper>
      )}
      {content && (
        <>
          <MoveStorageItemsDialog
            items={pendingMove}
            folder={content.folder}
            isMoving={moving.isPending}
            onCancel={() => setPendingMove(undefined)}
            onConfirm={move}
          />
          <CreateFolderDialog
            open={isCreatingFolder}
            userId={content.folder.userId}
            parent={folderId}
            onClose={() => setIsCreatingFolder(false)}
          />
        </>
      )}
    </Card>
  );
};
