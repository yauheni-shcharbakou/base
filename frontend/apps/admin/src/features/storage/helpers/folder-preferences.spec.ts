import { BrowserCommon, BrowserStorage } from '@packages/proto';
import { DEFAULT_FOLDER_CONTENT_PARAMS, FolderView } from './folder-content-params';
import {
  DEFAULT_FOLDER_PREFERENCES,
  getFolderContentDefaults,
  parseFolderPreferences,
  serializeFolderPreferences,
} from './folder-preferences';

describe('parseFolderPreferences', () => {
  it('reads what serializeFolderPreferences wrote', () => {
    const preferences = {
      view: FolderView.GALLERY,
      sortBy: BrowserStorage.StorageObjectSortField.UPDATED_AT,
      sortOrder: BrowserCommon.Sort.desc,
      galleryInfo: true,
    };

    expect(parseFolderPreferences(serializeFolderPreferences(preferences))).toEqual(preferences);
  });

  it('falls back to the defaults on a missing or garbled cookie', () => {
    expect(parseFolderPreferences(undefined)).toEqual(DEFAULT_FOLDER_PREFERENCES);
    expect(parseFolderPreferences('%%%;view=tiles&sortBy=size')).toEqual(
      DEFAULT_FOLDER_PREFERENCES,
    );
  });

  it('keeps nothing but the preferences', () => {
    expect(parseFolderPreferences('view=list&page=4&focus=abc')).toEqual({
      ...DEFAULT_FOLDER_PREFERENCES,
      view: FolderView.LIST,
    });
  });
});

describe('getFolderContentDefaults', () => {
  it('puts the preferences over the built-in defaults', () => {
    expect(
      getFolderContentDefaults({ ...DEFAULT_FOLDER_PREFERENCES, view: FolderView.LIST }),
    ).toEqual({ ...DEFAULT_FOLDER_CONTENT_PARAMS, view: FolderView.LIST });
  });
});
