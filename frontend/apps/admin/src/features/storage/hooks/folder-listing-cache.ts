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
