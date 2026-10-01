# 0030 — A move lands under a suffixed name; only a typed name is refused, and batch tree writes are one call

**Status:** Accepted (2026-09-30)
**Applies to:** `backend.storage`, `backend.api-gateway`, `frontend.admin`, `@packages/proto`

## Context

A name is unique among a folder's live objects (`storage-objects_name_unique`). Until now a create
suffixed a taken file name (` (n)`) and every edit refused one with a 409. That covered moves as
well: moving `docs` into a folder that already held a `docs` failed, and the admin's edit form put
the 409 on its `parent` field.

The folder browser now moves several objects at once, from its selection bar, a drag onto a folder
or a breadcrumb, or an item's menu, the way Google Drive does. A refusal fits that badly. Drive
allows duplicate names, so a move there never fails on one, and a batch that stops on the third of
forty items tells the user nothing useful. Three options were weighed for a clash in the target:

- **Refuse the whole batch with a 409** listing the taken names. Predictable, but every drag onto a
  busy folder turns into a rename-first chore, which is exactly what Drive's model avoids.
- **Skip the clashing items** and move the rest. The result is partial and has to be read carefully,
  and a later retry meets the same clash.
- **Suffix the moved item's name**, as an upload does. The move always happens, and the answer says
  which names changed.

Suffixing won, and it applies to a move of one object through the edit form too. Two move rules,
one refusing and one suffixing, would have left the user to guess which path a given move takes.

The batch calls also needed a shape. The gateway allows 100 unary calls a minute per user
(ADR-0024), so deleting a full page item by item would reach the limit on its own. N calls would
also not be atomic, and each would take the owner's tree lock (ADR-0019) separately.

## Decision

- **A move resolves a free name; a typed name is refused.** `StorageObjectValidationService.resolveFreeName`
  returns the name when it is free in the target, otherwise the first ` (n)` past the highest one
  taken. A folder takes the suffix after its whole name (`v1.2 (1)`), a file before its extension
  (`a (1).txt`). `StorageObjectUpdateOneUseCase` uses it whenever `parent` changes, whether or not
  the name changes with it. `StorageObjectMoveManyUseCase` uses it for every moved object. A 409 now
  comes only from a name the caller typed: a rename in place (`validateNameIsFree`) and a new
  folder (`validateObjectName`). The admin's `useStorageObjectForm` therefore always puts a 409 on
  `name`, and the edit page reports a move that landed under a new name.
- **Batch tree writes are one call.** The base `StorageObjectService` has `deleteMany` and
  `moveMany`, and the Admin audience has `deleteByIds` and `moveByIds`. Each call names objects of
  one owner (`validateBatch`: a missing, deleted or foreign id is `NotFound`, mixed owners a 400) and
  runs whole under that owner's tree lock, so it succeeds or changes nothing. A delete marks every
  subtree in one statement (`markManyDeletedWithDescendants`). A move writes the objects in the
  given order and resolves each name after the earlier ones have landed, so a batch cannot clash
  with itself; an object already in the target is left as it is. The gateway accepts 1–100 ids,
  the largest page of a folder listing.

## Consequences

- The name a move request carries is a wish, not a guarantee. Any client that shows the result
  must read the name back from the response. The admin compares the names it sent with the ones it
  got back (`getRenamedItems`) and says which changed.
- The rule of the 409 is narrower and easier to state: the name the caller typed is taken. A future
  client does not need to work out which field a conflict belongs to.
- A batch is one transaction holding one advisory lock for its whole length: up to 100 cascading
  `isPublic` writes and name lookups. That is fine for a page, but it is the reason for the 100-id
  cap. Raise the cap only after measuring how long the lock is held.
- The admin keeps a selection across a folder's pages, so it can pass the cap. It then sends the
  selection in calls of 100, one after another (`runInBatches`). Each call is atomic and the whole
  run is not: a failure stops it, and the admin reports how many items went through. That was
  preferred to capping the selection at 100, which would stop a routine "select three pages, move
  them" at the third page.
- The Web audience has neither batch call yet. The base messages already carry an optional
  `userId`, which a Web controller would fill with the caller's id to scope the batch.
