# 0018 — Folder paths are computed on read, and a folder's visibility cascades in its own transaction

**Status:** Accepted (2026-09-27)
**Applies to:** `backend.storage`, `@backend/event-bus`, `@backend/event-bus-redis`, `@backend/event-bus-nats`

## Context

A storage object stored two values derived from its folder:

- `folderPath`, the chain of folder names above it;
- `isPublic`, copied from the parent when the object is placed.

When a folder moved, or its `isPublic` changed, `StorageObjectUpdateOneUseCase` emitted `storage.storageObject.parentUpdate`. `StorageObjectUpdateFolderChildrenUseCase` then rewrote the folder's direct children in pages of 100 and emitted the event again for every subfolder, one level per job. That chain was wrong in more ways than it was slow:

- **The folder committed before the event was emitted.** With Redis down, the gRPC call failed, but the folder stayed moved and its subtree never followed.
- **`isPublic: false` never propagated.** The handler wrote `isPublic` only when `update.isPublic` was truthy.
- **Failures were acknowledged as success.** The `bulkUpdate` result was ignored, and `getList` returns an empty page on error, so a database failure acked the job as done.
- **Children could be skipped or repeated.** They were paged by offset with no `ORDER BY`, while the same loop rewrote `is_public`, an indexed column. Rows move on disk, so a large folder could skip or repeat children.
- **Stale events could win.** The payload carried a computed path, so a retried older event could overwrite a newer one.

`folderPath` is display-only: it appears on the show page and in the folder pickers. No Bunny key and no signed URL depends on it, so it is purely a read concern.

Alternatives:

- **Keep the column and cascade it with one recursive `UPDATE` in the folder's transaction.**
  - It fixes atomicity, but it is still a derived copy that every writer must keep in sync.
  - A folder created concurrently inside a moving subtree reads its parent's old path, unless structural writes are serialized per user.
  - Existing drift would need a repair task.
  - It would win if paths were looked up or filtered by. Nothing does that today.
- **Rewrite a materialized-path prefix** (`starts_with(folder_path, old)`). It needs no recursion, but:
  - paths are not unique, because a move does not check sibling names;
  - names may contain `/`;
  - leaves have no path, so `isPublic` still needs the `parent_id` walk.
- **Inherited visibility** (`is_public` nullable, meaning "as the parent").
  - Moves and toggles would write one row.
  - But it changes what `isPublic` means, and every `isPublic` filter would compute the effective value per row.
  - It can still be added later, on top of this decision.
- **A trigger.** It keeps the invariant for every writer, but hides the logic from the code and from MikroORM.

## Decision

- **`folder_path` is dropped** (`Migration20260926233417`). `PgStorageObjectEntity.folderPath` becomes a lazy `@Formula`: a correlated `WITH RECURSIVE` query that walks up `parent_id` from the row.
  - The result is `'/'` for a root folder, `'/A/B/'` for a nested folder, and null for a leaf. The `CASE` answers the root and leaf cases without running the walk.
  - The walk is bounded at 64 levels.
- **The path is computed only where a read asks for it:** the gRPC controller's `POPULATE` (`getById`, `getMany`, `getList`) and `StorageObjectGetFoldersUseCase`. Write responses do not carry it.
- **`isPublic` stays a stored flag.** `StorageObjectRepository.updateAndCascadePublic` does all of the following in one `em.transactional`:
  - locks the row (`PESSIMISTIC_WRITE`);
  - applies the update;
  - when a folder's `isPublic` changed, rewrites every descendant with one recursive `UPDATE`.

  A move takes the new parent's value through `validatePlacement`, so it spreads the same way.
- **The event is gone.** `storage.storageObject.parentUpdate`, `StorageObjectParentUpdateEvent` and `StorageObjectUpdateFolderChildrenUseCase` are removed. `RedisStorageObjectController` consumes only `auth.user.create`.
- **`parent_id` is indexed**, and every id-only walk (`markDeletedWithDescendants`, `getAllChildrenIds`, the cascade) uses `UNION`, so a `parent_id` cycle ends the recursion instead of looping.

## Consequences

- **No N+1.** A populated lazy formula is a column of the main SELECT.
  - `getList` issues its COUNT plus one SELECT that carries `(case …) as "folder_path"` next to the to-one media joins. MikroORM 7's default `balanced` strategy joins to-one relations.
  - Inside Postgres, each folder row costs one primary-key lookup per level. On ~8k rows, `EXPLAIN` shows `Index Scan using "storage-objects_pkey"` and 0.4 ms for a 100-folder page. On a toy table the planner picks a hash join instead, which is cheaper there.
  - `test/storage-object.tree.e2e-spec.ts` pins the statement count, so it cannot start growing with the page size.
- **The column had to go in the same release.**
  - MikroORM selects `"p0".*`, and the formula's field is named `folder_path`. With the column still present, a read that does not populate the path would hydrate the stale stored value.
  - The price is the deploy overlap. While the new container migrates and starts, the old container's writes that still set `folder_path` fail: folder create, move, and single media create.
  - `down()` re-adds the column and backfills it from the tree, so a rollback gets correct paths.
- **Typing trap.** `getMany`, `getOne` and `getList` infer `E` from their arguments. Without the explicit `<NestStorage.StorageObjectPopulated>` generic, `'folderPath'` fails the `keyof` check of `populate`.
- **Reads now recurse.** A `parent_id` cycle no longer hangs anything, but the paths it produces are nonsense until the rows are repaired. Two concurrent opposite moves could close one; [0019](0019-tree-writes-under-one-advisory-lock.md) serializes them.
- **Retiring the event leaves durable Redis state.** Subscriptions are never removed on their own (`@backend/event-bus-redis` `CLAUDE.md`, *Registries & parking*). After the deploy, remove by hand:
  - the subscription `event-bus:subs:storage.storage.object.parent.update`;
  - the BullMQ keys `bull:storage.storage.object.parent.update:*`;
  - the BullMQ keys `bull:storage.storage.object.parent.update@storage.storage-object:*`.

  The host runs two fewer workers — one mediator and one consumer — and their connections.
- **Relation to 0016.** 0016 made deletion a single recursive mark. This decision applies the same "one statement over the subtree" idea to visibility, and removes the need for any statement for paths.
