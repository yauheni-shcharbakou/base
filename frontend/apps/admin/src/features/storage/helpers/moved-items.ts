import type { BrowserStorage } from '@packages/proto';

/** What a move answered with, against what was sent: the items that came back under a new name. */
export const getRenamedItems = (
  sent: Pick<BrowserStorage.StorageObjectFolderItem, 'id' | 'name'>[],
  moved: Pick<BrowserStorage.StorageObject, 'id' | 'name'>[],
): { from: string; to: string }[] => {
  const nameById = new Map(moved.map((item) => [item.id, item.name]));

  return sent
    .filter((item) => nameById.has(item.id) && nameById.get(item.id) !== item.name)
    .map((item) => ({ from: item.name, to: nameById.get(item.id) as string }));
};
