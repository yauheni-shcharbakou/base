# 0033 — A folder's file count, folder count and size are computed on read, never stored

**Status:** Accepted (2026-10-01)
**Applies to:** `backend.storage`, `@packages/proto`, `frontend.admin`

## Context

The admin shows what a folder holds: how many files and subfolders are in its whole subtree, and how
many bytes those files weigh. It shows this for the folder being viewed, for its show page, for every
subfolder in a folder listing, and for every folder on the storage-objects list. The tree is an
adjacency list (`parent_id`), so nothing on a folder's row says what lies below it.

Alternatives:

- **Counters on `storage-objects`, kept by event-bus events.** An upload that turns READY, a move or
  a delete would emit an event, and a subscriber would add or subtract the delta on every ancestor.
  - This is the shape [ADR-0018](0018-folder-paths-computed-on-read.md) removed for `folderPath`. It
    commits the write before the event, so a lost emit leaves the counters wrong for good.
  - The Redis bus is at-least-once, so a redelivered delta counts twice unless each one is made
    idempotent, which a bare `+= size` is not.
  - The write and its effect sit in the same service and the same database. The bus exists for
    crossing a service boundary, and here there is none to cross.
- **Counters kept in the writer's own transaction.** It is atomic, but still a derived copy that every
  writer must keep in step:
  - completion (`FileCompletionService`), the three video webhook events and the video sync;
  - a move, which subtracts from the old ancestors and adds to the new ones;
  - the subtree delete mark, the cleanup crons, a leaf created over existing media, `createFolders`.

  Missing one drifts silently, and a repair task would be needed to find out. Every write also
  updates the owner's root folder row, so a drop of 50 files makes 50 transactions queue on one
  row.
- **A trigger.** It keeps the counters for every writer, but hides the logic from the code and from
  MikroORM, as ADR-0018 already weighed.

## Decision

- **`PgStorageObjectEntity.folderStats` is a lazy `@Formula` of `type: 'json'`.** For a folder it is a
  correlated `WITH RECURSIVE` walk down live children by `parent_id`, joined to `files` through
  `file_id`, aggregated into one `json_build_object`:
  - `folderCount`: the live subfolders at any depth;
  - `fileCount`: the live leaves whose file is `READY` (an image or a video counts through its backing
    file);
  - `totalSize`: the sum of those files' `size`.

  For a leaf it is null. The walk uses `UNION` over ids, so a `parent_id` cycle ends it.
- **The proto carries it as `StorageObjectFolderStats`**, an optional field of `StorageObject`,
  `StorageObjectPopulated` and `StorageObjectFolderItem`. `totalSize` is a `double`: a sum outgrows
  `int32` past 2 GiB, and an `int64` would reach Node as a `Long`, since the gRPC loader sets no
  `longs` option.
- **Only the reads that show it ask for it:** `getById` and `getList` (the controller's
  `POPULATE_WITH_STATS`), and both the folder and the items of `getFolderContent`. `getMany`,
  `getFolders` and the rows a write reads back do not.

## Consequences

- **It is always right, and no write path knows it exists.** A new writer cannot forget to update it.
- **A read costs a walk of the subtree** instead of one row. The folders of one page have disjoint
  subtrees, so a listing walks about as many rows as the subtree of the folder it lists. For a root
  folder, or a storage-objects list page that holds roots, that is the owner's whole tree. The
  formula is a column of the same SELECT, so the statement counts stay as they were: four for
  `getFolderContent`, one plus a COUNT for `getList`.
- **Nothing can sort or filter by size.** A formula is not indexed, so sorting a page by it would walk
  every folder of the owner. The admin's Size columns are therefore not sortable.
- **Revisit** once trees reach hundreds of thousands of objects, or once sorting or filtering by size
  is needed. The alternative then is counters written in the writer's transaction, with a repair task
  that recomputes them from this same query. Never event-bus deltas.
