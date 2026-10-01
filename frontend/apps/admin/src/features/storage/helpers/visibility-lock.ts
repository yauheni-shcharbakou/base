/**
 * The visibility an object is held to by its folder, when it has no say of its own: in a public
 * folder it is public — the service refuses to make it private — and a move gives it the visibility
 * of the folder it moves to, whatever was asked. `undefined` leaves the choice to the caller: an
 * object staying in a private folder, or a folder whose visibility is not known yet.
 */
export type VisibilityLock = { isPublic: boolean; reason: string };

export const getVisibilityLock = (
  parent: { isPublic: boolean } | undefined,
  isMove: boolean,
): VisibilityLock | undefined => {
  if (!parent) {
    return undefined;
  }

  if (isMove) {
    return { isPublic: parent.isPublic, reason: 'Takes the visibility of the folder it moves to' };
  }

  return parent.isPublic
    ? { isPublic: true, reason: 'Inherited from the public folder' }
    : undefined;
};
