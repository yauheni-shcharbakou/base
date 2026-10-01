import {
  DEFAULT_FOLDER_CONTENT_PARAMS,
  FolderContentParams,
  parseFolderContentParams,
} from './folder-content-params';

/**
 * The cookie a folder view's preferences live in. A cookie, not local storage: the page reads it on
 * the server, so the first render already has the saved view and sort — no flash of the defaults,
 * no hydration mismatch, no listing fetched in the wrong order first.
 */
export const FOLDER_PREFERENCES_COOKIE = 'storage-folder-preferences';

/** What a folder view remembers between visits; everything else is per page, in the URL. */
export type FolderPreferences = Pick<FolderContentParams, 'view' | 'sortBy' | 'sortOrder'> & {
  // Whether the gallery shows the selected item's details over its stage.
  galleryInfo: boolean;
};

export const FOLDER_PREFERENCE_KEYS = ['view', 'sortBy', 'sortOrder'] as const;

export const DEFAULT_FOLDER_PREFERENCES: FolderPreferences = {
  view: DEFAULT_FOLDER_CONTENT_PARAMS.view,
  sortBy: DEFAULT_FOLDER_CONTENT_PARAMS.sortBy,
  sortOrder: DEFAULT_FOLDER_CONTENT_PARAMS.sortOrder,
  galleryInfo: false,
};

/** Reads the cookie's value; a missing, stale or garbled one falls back to the defaults. */
export const parseFolderPreferences = (raw?: string): FolderPreferences => {
  const search = new URLSearchParams(raw ?? '');
  const { view, sortBy, sortOrder } = parseFolderContentParams(search);

  return { view, sortBy, sortOrder, galleryInfo: search.get('galleryInfo') === '1' };
};

export const serializeFolderPreferences = ({
  view,
  sortBy,
  sortOrder,
  galleryInfo,
}: FolderPreferences): string =>
  new URLSearchParams({ view, sortBy, sortOrder, galleryInfo: galleryInfo ? '1' : '0' }).toString();

/** The URL's fallbacks for a viewer with these preferences. */
export const getFolderContentDefaults = (preferences: FolderPreferences): FolderContentParams => ({
  ...DEFAULT_FOLDER_CONTENT_PARAMS,
  view: preferences.view,
  sortBy: preferences.sortBy,
  sortOrder: preferences.sortOrder,
});
