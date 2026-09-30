import type { BrowserStorage } from '@packages/proto';
import type { QueryClient } from '@tanstack/react-query';
import { FOLDER_CONTENT_QUERY_KEY } from './use-folder-content';

/**
 * Takes items out of every cached folder listing at once — deleted, or moved out of their folder —
 * so they leave the screen before the refetch that follows brings the page up to date.
 */
export const dropFromFolderListings = (
  queryClient: QueryClient,
  items: Pick<BrowserStorage.StorageObjectFolderItem, 'id'>[],
) => {
  const gone = new Set(items.map(({ id }) => id));

  queryClient.setQueriesData<BrowserStorage.StorageObjectFolderContent>(
    { queryKey: FOLDER_CONTENT_QUERY_KEY },
    (content) => {
      if (!content?.items.some(({ id }) => gone.has(id))) {
        return content;
      }

      const kept = content.items.filter(({ id }) => !gone.has(id));
      return {
        ...content,
        items: kept,
        total: content.total - (content.items.length - kept.length),
      };
    },
  );
};

type Written = Pick<BrowserStorage.StorageObject, 'id' | 'name' | 'isPublic' | 'updatedAt'>;

/**
 * Writes renamed or re-published objects into every cached folder listing at once — its items and
 * the folder it shows — so the change shows before the refetch that follows. A folder's subtree,
 * which its visibility reaches too, is left to that refetch.
 */
export const patchFolderListings = (queryClient: QueryClient, written: Written[]) => {
  const byId = new Map(written.map((row) => [row.id, row]));
  const patch = <T extends Written>(object: T): T => {
    const row = byId.get(object.id);
    return row
      ? { ...object, name: row.name, isPublic: row.isPublic, updatedAt: row.updatedAt }
      : object;
  };

  queryClient.setQueriesData<BrowserStorage.StorageObjectFolderContent>(
    { queryKey: FOLDER_CONTENT_QUERY_KEY },
    (content) => {
      if (
        !content ||
        (!byId.has(content.folder.id) && !content.items.some(({ id }) => byId.has(id)))
      ) {
        return content;
      }

      return { ...content, folder: patch(content.folder), items: content.items.map(patch) };
    },
  );
};
