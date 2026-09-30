import type { HttpError } from '@refinedev/core';

/**
 * The backend alone owns the storage-object name rule, and it answers a taken name with a 409 —
 * the only refusal of a create or an edit that is a conflict. Only a name the caller typed is
 * refused — a new folder's, a rename in place — so the refusal always belongs on the name field; a
 * move lands under a suffixed name instead. The admin keeps no copy of the rule: it recognises the
 * refusal and shows the backend's own message.
 */
export const isNameConflict = (error?: Pick<HttpError, 'statusCode'>): boolean =>
  error?.statusCode === 409;
