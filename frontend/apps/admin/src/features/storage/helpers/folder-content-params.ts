import { BrowserCommon, BrowserStorage } from '@packages/proto';

export enum FolderView {
  GRID = 'grid',
  LIST = 'list',
  GALLERY = 'gallery',
}

export const FOLDER_PAGE_SIZES = [25, 50, 100];

/** Everything a folder view keeps in its URL, so a reload or a shared link shows the same page. */
export type FolderContentParams = {
  view: FolderView;
  sortBy: BrowserStorage.StorageObjectSortField;
  sortOrder: BrowserCommon.Sort;
  page: number;
  pageSize: number;
  // A case-insensitive substring of the name, matched among this folder's own items only.
  search?: string;
  // No types means every type.
  types: BrowserStorage.StorageObjectType[];
  // The item a gallery has selected, or the one a grid or list marks — the folder just left.
  item?: string;
};

export const DEFAULT_FOLDER_CONTENT_PARAMS: FolderContentParams = {
  view: FolderView.GRID,
  sortBy: BrowserStorage.StorageObjectSortField.NAME,
  sortOrder: BrowserCommon.Sort.asc,
  page: 1,
  pageSize: 50,
  types: [],
};

const KEYS: (keyof FolderContentParams)[] = [
  'view',
  'sortBy',
  'sortOrder',
  'page',
  'pageSize',
  'search',
  'types',
  'item',
];

// Changing any of these moves every item, so the page that was open no longer means anything.
const PAGE_RESETTING_KEYS: (keyof FolderContentParams)[] = [
  'sortBy',
  'sortOrder',
  'pageSize',
  'search',
  'types',
];

const ALL_TYPES = Object.values(BrowserStorage.StorageObjectType);

const oneOf = <T extends string>(values: T[], value: string | null, fallback: T): T =>
  values.includes(value as T) ? (value as T) : fallback;

const positiveInt = (value: string | null): number | undefined => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
};

// Known types only, each once, in the enum's order — so one filter is always one query key.
const typesOf = (value: string | null): BrowserStorage.StorageObjectType[] => {
  const listed = new Set(value?.split(','));
  return ALL_TYPES.filter((type) => listed.has(type));
};

const serialize = (value: FolderContentParams[keyof FolderContentParams]): string =>
  Array.isArray(value) ? value.join(',') : String(value ?? '');

/**
 * Reads the view's state from the URL; a missing or unknown value falls back to `defaults` — the
 * viewer's saved preferences over the built-in defaults.
 */
export const parseFolderContentParams = (
  search: Pick<URLSearchParams, 'get'>,
  defaults: FolderContentParams = DEFAULT_FOLDER_CONTENT_PARAMS,
): FolderContentParams => {
  const pageSize = positiveInt(search.get('pageSize'));

  return {
    view: oneOf(Object.values(FolderView), search.get('view'), defaults.view),
    sortBy: oneOf(
      Object.values(BrowserStorage.StorageObjectSortField),
      search.get('sortBy'),
      defaults.sortBy,
    ),
    sortOrder: oneOf(
      Object.values(BrowserCommon.Sort),
      search.get('sortOrder'),
      defaults.sortOrder,
    ),
    page: positiveInt(search.get('page')) ?? defaults.page,
    pageSize: pageSize && FOLDER_PAGE_SIZES.includes(pageSize) ? pageSize : defaults.pageSize,
    search: search.get('search')?.trim() || undefined,
    types: typesOf(search.get('types')),
    item: search.get('item') || undefined,
  };
};

/**
 * The URL query after `patch`: other parameters are kept, a value equal to `defaults` is left out,
 * and a new sort, page size or filter goes back to the first page unless the patch names one.
 * `current` is what the view shows now, when the caller knows it better than the URL does.
 */
export const applyFolderContentParams = (
  search: string,
  patch: Partial<FolderContentParams>,
  defaults: FolderContentParams = DEFAULT_FOLDER_CONTENT_PARAMS,
  current: FolderContentParams = parseFolderContentParams(new URLSearchParams(search), defaults),
): URLSearchParams => {
  const params = new URLSearchParams(search);
  const next: Partial<FolderContentParams> = { ...current, ...patch };
  next.types = typesOf(serialize(next.types));

  const isReordered = PAGE_RESETTING_KEYS.some(
    (key) => key in patch && serialize(next[key]) !== serialize(current[key]),
  );

  if (isReordered && !('page' in patch)) {
    next.page = DEFAULT_FOLDER_CONTENT_PARAMS.page;
  }

  KEYS.forEach((key) => {
    const value = serialize(next[key]);

    if (!value || value === serialize(defaults[key])) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  });

  return params;
};
