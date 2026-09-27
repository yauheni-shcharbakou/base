import type { HttpError } from '@refinedev/core';

/** The fields of a storage-object form that the backend's name refusal can land on. */
export type NameConflictField = 'name' | 'parent';

/**
 * The backend alone owns the storage-object name rule, and it answers a taken name with a 409 —
 * the only refusal of a create or an edit that is a conflict. The admin keeps no copy of the rule:
 * it recognises the refusal and shows the backend's own message.
 */
export const isNameConflict = (error?: Pick<HttpError, 'statusCode'>): boolean =>
  error?.statusCode === 409;

/**
 * Where the refusal belongs: on the name when the save sets one, otherwise on the folder — a move
 * that kept its name, into a folder that already holds it.
 */
export const nameConflictField = (values?: {
  name?: unknown;
  parent?: unknown;
}): NameConflictField => (values?.name ? 'name' : 'parent');
