import { getQueryRetryDelay, retryUpTo } from '@/common/helpers/query-retry';
import {
  applyFolderContentParams,
  FOLDER_PREFERENCE_KEYS,
  FOLDER_PREFERENCES_COOKIE,
  FolderContentParams,
  FolderPreferences,
  getFolderContentDefaults,
  getFolderContentPath,
  parseFolderContentParams,
  parseFolderPreferences,
  serializeFolderPreferences,
} from '@/features/storage/helpers';
import { folderActionProvider } from '@/features/storage/providers';
import type { BrowserStorage } from '@packages/proto';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Cookies from 'js-cookie';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ContentPage = Pick<
  FolderContentParams,
  'sortBy' | 'sortOrder' | 'page' | 'pageSize' | 'search' | 'types'
>;

/** The prefix of every folder listing's query key — what a write invalidates. */
export const FOLDER_CONTENT_QUERY_KEY = ['storage-folder-content'] as const;

// Short of a preview URL's shortest life — ten minutes for storage (ADR-0026) — so a view that
// comes back to a folder gets fresh thumbnails before the old ones expire.
const STALE_TIME_MS = 60_000;
// A failed thumbnail refetches the listing, but not again right after a refetch: a thumbnail that
// fails with a fresh URL fails for another reason.
const PREVIEW_REFRESH_AFTER_MS = 30_000;
const PREFERENCES_COOKIE_DAYS = 365;

// Folder id → owner id, learned from every listing: a user's tree is closed, so a folder's owner is
// its root's. With the owner known, a listing is one gateway call instead of two.
const ownerByFolder = new Map<string, string>();

// Folder id → the page last shown in it, so going back up lands where the folder was left.
const lastPageByFolder = new Map<string, number>();

const toHref = (path: string, search: URLSearchParams) => {
  const query = search.toString();
  return query ? `${path}?${query}` : path;
};

// The cookie as it is now, over what the server read: a page the router restores from its cache
// (Back, Forward) was rendered with the preferences of its time. On the first load both agree.
const readPreferences = (fromServer: FolderPreferences): FolderPreferences => {
  const raw = typeof document === 'undefined' ? undefined : Cookies.get(FOLDER_PREFERENCES_COOKIE);
  return raw ? parseFolderPreferences(raw) : fromServer;
};

const rememberOwner = (content: BrowserStorage.StorageObjectFolderContent) => {
  const { id, userId } = content.folder;

  ownerByFolder.set(id, userId);
  content.ancestors.forEach((ancestor) => ownerByFolder.set(ancestor.id, userId));
  content.items
    .filter((item) => item.isFolder)
    .forEach((item) => ownerByFolder.set(item.id, userId));
};

// A retryable failure — the rate limit, a server failure — is tried twice more (`retryUpTo`).
const MAX_RETRIES = 2;

const folderContentQuery = (
  folderId: string,
  { sortBy, sortOrder, page, pageSize, search, types }: ContentPage,
) => ({
  queryKey: [
    ...FOLDER_CONTENT_QUERY_KEY,
    folderId,
    sortBy,
    sortOrder,
    page,
    pageSize,
    search ?? '',
    types.join(','),
  ] as const,
  queryFn: async () => {
    const content = await folderActionProvider.getFolderContent({
      folderId,
      userId: ownerByFolder.get(folderId),
      sortBy,
      sortOrder,
      page,
      pageSize,
      search,
      types,
    });

    rememberOwner(content);
    return content;
  },
  staleTime: STALE_TIME_MS,
  retry: retryUpTo(MAX_RETRIES),
  retryDelay: getQueryRetryDelay,
});

/**
 * A page of a folder, with the view's state — view, sort, filters, page, selection — kept in the
 * URL, over the viewer's saved preferences. Not a Refine data-provider call: a folder listing is not
 * a CRUD list, so it goes through its own server action under React Query directly.
 */
export const useFolderContent = (folderId: string, initialPreferences: FolderPreferences) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [preferences, setPreferences] = useState(() => readPreferences(initialPreferences));

  const defaults = useMemo(() => getFolderContentDefaults(preferences), [preferences]);
  const params = useMemo(
    () => parseFolderContentParams(searchParams, defaults),
    [searchParams, defaults],
  );

  const query = useQuery({
    ...folderContentQuery(folderId, params),
    // The previous page stays on screen while the next loads — within one folder only: another
    // folder's items under this folder's name would be wrong, not just stale.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === folderId ? previous : undefined,
  });

  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / params.pageSize));

  const savePreferences = useCallback(
    (patch: Partial<FolderPreferences>) => {
      const next = { ...preferences, ...patch };

      setPreferences(next);
      Cookies.set(FOLDER_PREFERENCES_COOKIE, serializeFolderPreferences(next), {
        expires: PREFERENCES_COOKIE_DAYS,
        sameSite: 'lax',
      });

      return next;
    },
    [preferences],
  );

  /**
   * Changes the view's state; `replace` for a step that should not be its own history entry. A new
   * view or sort is the viewer's choice, so it is saved as their preference too — and, being the
   * preference now, leaves the URL.
   *
   * Through the native history API, which Next syncs with `useSearchParams`, not the router: the
   * server renders nothing from these parameters, and a router navigation would fetch the page
   * from it on every step — the URL would trail the keys, and a step taken before it caught up
   * would read a stale selection.
   */
  const setParams = useCallback(
    (patch: Partial<FolderContentParams>, mode: 'push' | 'replace' = 'push') => {
      const preferencePatch = Object.fromEntries(
        FOLDER_PREFERENCE_KEYS.filter((key) => key in patch).map((key) => [key, patch[key]]),
      );
      const nextDefaults = Object.keys(preferencePatch).length
        ? getFolderContentDefaults(savePreferences(preferencePatch))
        : defaults;

      const search = applyFolderContentParams(searchParams.toString(), patch, nextDefaults, params);
      const href = toHref(pathname, search);

      if (mode === 'push') {
        window.history.pushState(null, '', href);
      } else {
        window.history.replaceState(null, '', href);
      }
    },
    [pathname, searchParams, params, defaults, savePreferences],
  );

  const setGalleryInfo = useCallback(
    (galleryInfo: boolean) => savePreferences({ galleryInfo }),
    [savePreferences],
  );

  /** A subfolder's URL: this view's layout and sort, on its first page, with no filters. */
  const getFolderHref = useCallback(
    (id: string) =>
      toHref(
        getFolderContentPath(id),
        applyFolderContentParams(
          searchParams.toString(),
          { page: 1, focus: undefined, search: undefined, types: [] },
          defaults,
          params,
        ),
      ),
    [searchParams, defaults, params],
  );

  /**
   * An ancestor's URL on the way up: the page it was left on, with the folder that leads back down
   * marked for the keyboard, as Finder marks the folder just left.
   */
  const getAncestorHref = useCallback(
    (id: string, focus?: string) =>
      toHref(
        getFolderContentPath(id),
        applyFolderContentParams(
          searchParams.toString(),
          {
            page: (focus && lastPageByFolder.get(id)) || 1,
            focus,
            search: undefined,
            types: [],
          },
          defaults,
          params,
        ),
      ),
    [searchParams, defaults, params],
  );

  /**
   * Marks an item in this page's own history entry, without navigating: the browser's Back then
   * returns to it. Next syncs the native history API with `useSearchParams`.
   */
  const markItem = useCallback(
    (id: string) => {
      const search = applyFolderContentParams(
        searchParams.toString(),
        { focus: id },
        defaults,
        params,
      );
      window.history.replaceState(null, '', toHref(pathname, search));
    },
    [searchParams, defaults, params, pathname],
  );

  const { dataUpdatedAt, refetch } = query;

  // ADR-0026: a view left open refetches its listing once a thumbnail fails — its URL expired.
  const refreshPreviews = useCallback(() => {
    if (Date.now() - dataUpdatedAt > PREVIEW_REFRESH_AFTER_MS) {
      refetch({ cancelRefetch: false });
    }
  }, [dataUpdatedAt, refetch]);

  const prefetchPage = useCallback(
    (page: number) => queryClient.prefetchQuery(folderContentQuery(folderId, { ...params, page })),
    [queryClient, folderId, params],
  );

  const isShown = !!query.data && !query.isPlaceholderData;

  useEffect(() => {
    if (isShown) {
      lastPageByFolder.set(folderId, params.page);
    }
  }, [isShown, folderId, params.page]);

  // Objects deleted since the link was made can leave a page past the end.
  const isPastLastPage = isShown && params.page > pageCount;

  useEffect(() => {
    if (isPastLastPage) {
      setParams({ page: pageCount, focus: undefined }, 'replace');
    }
  }, [isPastLastPage, pageCount, setParams]);

  return {
    params,
    setParams,
    preferences,
    setGalleryInfo,
    getFolderHref,
    getAncestorHref,
    markItem,
    content: query.data,
    error: query.error,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isPlaceholderData: query.isPlaceholderData,
    pageCount,
    refreshPreviews,
    prefetchPage,
  };
};
