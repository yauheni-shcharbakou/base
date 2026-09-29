import { BrowserCommon, BrowserStorage } from '@packages/proto';
import {
  applyFolderContentParams,
  DEFAULT_FOLDER_CONTENT_PARAMS,
  FolderView,
  parseFolderContentParams,
} from './folder-content-params';

const parse = (search: string) => parseFolderContentParams(new URLSearchParams(search));

describe('parseFolderContentParams', () => {
  it('reads every parameter', () => {
    expect(
      parse(
        'view=gallery&sortBy=UPDATED_AT&sortOrder=desc&page=3&pageSize=100&search=cat&types=IMAGE&item=abc',
      ),
    ).toEqual({
      view: FolderView.GALLERY,
      sortBy: BrowserStorage.StorageObjectSortField.UPDATED_AT,
      sortOrder: BrowserCommon.Sort.desc,
      page: 3,
      pageSize: 100,
      search: 'cat',
      types: [BrowserStorage.StorageObjectType.IMAGE],
      item: 'abc',
    });
  });

  it('keeps known types only, each once, in a stable order', () => {
    expect(parse('types=VIDEO,SOUND,IMAGE,VIDEO').types).toEqual([
      BrowserStorage.StorageObjectType.IMAGE,
      BrowserStorage.StorageObjectType.VIDEO,
    ]);
  });

  it('trims the search and drops a blank one', () => {
    expect(parse('search=%20cat%20').search).toBe('cat');
    expect(parse('search=%20%20').search).toBeUndefined();
  });

  it('falls back to the given defaults — the saved preferences', () => {
    const defaults = {
      ...DEFAULT_FOLDER_CONTENT_PARAMS,
      view: FolderView.LIST,
      sortOrder: BrowserCommon.Sort.desc,
    };

    expect(parseFolderContentParams(new URLSearchParams(''), defaults)).toEqual(defaults);
    expect(parseFolderContentParams(new URLSearchParams('view=grid'), defaults).view).toBe(
      FolderView.GRID,
    );
  });

  it('falls back to the defaults on missing or unknown values', () => {
    expect(parse('')).toEqual(DEFAULT_FOLDER_CONTENT_PARAMS);
    expect(parse('view=tiles&sortBy=size&sortOrder=up&page=-1&pageSize=33&item=')).toEqual(
      DEFAULT_FOLDER_CONTENT_PARAMS,
    );
    expect(parse('page=1.5').page).toBe(1);
  });
});

describe('applyFolderContentParams', () => {
  it('leaves defaults out of the URL and keeps unrelated parameters', () => {
    const params = applyFolderContentParams('foo=bar&view=list', { view: FolderView.GRID });
    expect(params.toString()).toBe('foo=bar');
  });

  it('goes back to the first page on a new sort or page size', () => {
    expect(
      applyFolderContentParams('page=4', { sortOrder: BrowserCommon.Sort.desc }).toString(),
    ).toBe('sortOrder=desc');
    expect(applyFolderContentParams('page=4', { pageSize: 100 }).toString()).toBe('pageSize=100');
  });

  it('keeps the page when the sort does not change, or when the patch names one', () => {
    expect(
      applyFolderContentParams('page=4', {
        sortBy: BrowserStorage.StorageObjectSortField.NAME,
      }).toString(),
    ).toBe('page=4');
    expect(applyFolderContentParams('page=4', { pageSize: 25, page: 2 }).toString()).toBe(
      'page=2&pageSize=25',
    );
  });

  it('goes back to the first page on a new search or type filter', () => {
    expect(applyFolderContentParams('page=4', { search: 'cat' }).toString()).toBe('search=cat');
    expect(
      applyFolderContentParams('page=4', {
        types: [BrowserStorage.StorageObjectType.VIDEO, BrowserStorage.StorageObjectType.IMAGE],
      }).toString(),
    ).toBe('types=IMAGE%2CVIDEO');
    expect(applyFolderContentParams('page=4&types=IMAGE', { types: [] }).toString()).toBe('');
  });

  it('leaves out what equals the given defaults', () => {
    const defaults = { ...DEFAULT_FOLDER_CONTENT_PARAMS, view: FolderView.LIST };

    expect(
      applyFolderContentParams('view=gallery', { view: FolderView.LIST }, defaults).toString(),
    ).toBe('');
    expect(applyFolderContentParams('', { view: FolderView.GRID }, defaults).toString()).toBe(
      'view=grid',
    );
  });

  it('compares with what the view shows when the caller passes it', () => {
    const current = {
      ...DEFAULT_FOLDER_CONTENT_PARAMS,
      page: 4,
      sortOrder: BrowserCommon.Sort.desc,
    };

    expect(
      applyFolderContentParams(
        'page=4',
        { sortOrder: BrowserCommon.Sort.desc },
        DEFAULT_FOLDER_CONTENT_PARAMS,
        current,
      ).toString(),
    ).toBe('page=4&sortOrder=desc');
  });

  it('drops a parameter patched to undefined', () => {
    expect(applyFolderContentParams('item=abc&page=2', { item: undefined }).toString()).toBe(
      'page=2',
    );
  });
});
