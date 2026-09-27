# 0021 — A user's storage tree is closed, and its writes queue per owner

**Status:** Accepted (2026-09-27), supersedes 0019 in part (its lock key and its exemption for creates)
**Applies to:** `backend.storage`, `backend.api-gateway`

## Context

A storage object's parent was checked only for being a folder. `validatePlacement` looked it up by
`{ id, type: FOLDER }`, with no owner and no `isDeleted`. As a result:

- A web user who knew another user's folder id could create an object in it, or move their own
  object into it. The gateway scopes the object to the caller, never the new parent.
- An object could be created in, or moved into, a deleted folder. It stayed live there, and nothing
  ever showed it or removed it. The file cleanup reaches only media whose own row is deleted, and
  the folder cleanup waits for a folder to have no children.
- The three media `createMany` use cases skipped placement altogether. They did not check the
  parent at all, and they took `isPublic` from the caller.
- Names were checked read-then-write, outside any lock, so two parallel uploads of `a.txt` both
  got `a.txt`.

[0019](0019-tree-writes-under-one-advisory-lock.md) chose one lock key for every user's tree because
placement did not check the owner. A `parent` link could cross two trees, so two opposite moves
guarded by different per-user keys could still close a cycle. 0019 named the per-owner key as the
better choice once placement enforced the owner.

Alternatives for the owner invariant:

- **Checks in the service only.** This covers every path the service has today, but not a row
  written by a migration, a script or a future use case that forgets the check. The per-owner lock
  is only correct if no link crosses two trees, so that has to hold for every row.
- **A trigger.** It works, but it hides the rule in procedural code, and a trigger that reads the
  parent races concurrent writes unless it takes a lock itself.
- **Keep the global lock.** This is simpler, but the service already runs one queue for every user,
  and creates would join it. Every upload would then wait behind every other user's tree write.

## Decision

- **Placement is owner-scoped.** `StorageObjectValidationService.validatePlacement(parent, userId)`
  accepts only a live folder with that owner. A missing, deleted or foreign parent all return the
  same `NotFound`, so a caller learns nothing about ids outside its own tree. A move takes the
  owner of the moved object, not of the caller: an admin moves within the object's tree, too. Name
  checks are scoped to the owner as well.
- **The database holds the invariant.** `storage-objects_parent_owner_foreign` is
  `(user_id, parent_id) references (user_id, id)` and targets `storage-objects_owner_id_unique`. It
  is declared in the migration, because MikroORM cannot express a foreign key onto a non-primary
  key. `parent` therefore sets `createForeignKeyConstraint: false`. The key is `on delete no action`,
  not `set null`: folders are deleted leaves first, so a parent deleted ahead of its child is a bug
  to fail on. Under `set null` it silently turned the child into a second root.
- **A name is unique among a folder's live objects, whatever their kind.** Earlier, a folder's name
  was taken only by another folder and a file's by any object. So a folder could be created next to
  a file of the same name, but not the other way round. That asymmetry needed two indexes and a
  kind-aware check in both the service and the admin. It is now one rule: create refuses a taken
  folder name and suffixes a taken file name, and a rename or a move refuses either. The database
  backs it with one partial unique index, `storage-objects_name_unique` on `(parent_id, name)` where
  not deleted.
- **A taken name is a 409, and the admin shows it on the field instead of checking it first.**
  `ConflictException` is the only conflict a create or an edit of a storage object returns. The
  update's own unique violation maps to the same 409. So the admin's `useStorageObjectForm` can
  recognise it by status alone and put the backend's message on `name`, or on `parent` for a move
  that kept its name. Refine's notification is suppressed for it. This drops the pre-save
  `isExists` lookups that [0020](0020-server-action-failures-as-values.md) kept for UX. They held a
  second copy of the rule, which drifted when the rule changed, raced the write they guarded and
  cost a round trip. A 400 would not do: the same calls also answer "Invalid parent" with 400, and
  telling the two apart would mean matching message text.
- **One lock key per owner.** `withTreeLock(userId, work)` takes
  `pg_advisory_xact_lock(hashtext('storage-objects.tree'), hashtext(userId))`.
  - Update and delete first read the object's owner outside the lock. This is safe because an owner
    never changes. They then take the lock and read everything again inside it.
- **Creates run under the lock.** The folder create does. So does every media create, through
  `StorageObjectPlacementService.placeLeaves`: the folder check, the names and `saveAndPlace*` share
  one transaction. A batch is suffixed in order, so its items cannot clash with each other.
- **Video creates check placement before `createVideo`.** A Stream object exists from that call on,
  so its purpose is to fail before Bunny is reached. If the row is not saved afterwards, the use
  case purges every Stream object it created.

## Consequences

- **Owners do not wait for each other.** Two owners queue behind each other only when their ids
  hash alike, which is harmless. The same owner's uploads, moves and deletions still run one at a
  time. A waiter still holds its pool connection, as under 0019.
- **The lock covers only database work.** Provider calls (`createVideo`, signing) run outside it.
  Keep it that way: a slow HTTP call inside `save` stalls the owner's whole tree.
- **The cleanup crons take no lock.** Placement refuses a deleted parent under the same lock that
  marks it, so no live child appears under a deleted folder. The `no action` key turns any remaining
  race in `deleteEmptyDeletedFolders` into a failed statement instead of a new root.
- **The migration refuses bad data instead of repairing it.** It lists rows that break a rule:
  foreign parents, duplicate live names, and names that are empty or hold `/`. The one repair it
  makes is to mark objects left live under a deleted folder, which were unreachable anyway.
- **A leaf over existing media is owner-scoped as well.** `StorageObjectCreate` keeps its
  `file`/`image`/`video` ids for a future admin picker. `validateMedia` accepts only unplaced, `READY` media
  of the object's owner, read by the media row's own `user_id`, and refuses another user's media as
  `NotFound`. Without the check, a leaf over someone else's file let its owner delete that file
  through the cleanup cron. The database does not hold this rule: a composite key per media table
  would need three more unique constraints, and the service reads the media under the owner's lock.
