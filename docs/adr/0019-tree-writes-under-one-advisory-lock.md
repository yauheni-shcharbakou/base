# 0019 — Writes to the storage-object tree run under one advisory lock

**Status:** Superseded in part by 0021 (2026-09-27) — the lock key is per owner, and creates take it
**Applies to:** `backend.storage`

## Context

A move checks that the new parent is not inside the moved folder's own subtree
(`getAllChildrenIds`), and then writes `parent_id`. The check and the write are separate statements,
so two opposite moves (A into B, B into A) can both pass the check before either commits. Together
they close a `parent_id` cycle and cut both folders off from the root. A probe of 30 concurrent
pairs against Postgres closed 5 cycles. [0018](0018-folder-paths-computed-on-read.md) made every walk
end on a cycle, but the paths such a cycle produces are nonsense.

The row lock that `updateAndCascadePublic` takes does not help, because the two moves lock different
rows. The descendant walk also failed open: on a database error `getAllChildrenIds` returned an
empty set. An empty set reads as "no descendants", so the move went through.

Alternatives:

- **A lock per user.** It serializes only the moves inside one user's tree. That is enough only if
  no `parent` link crosses two users, and placement does not check the owner. As a result, a cycle
  can run through two trees whose moves take different locks. This becomes the better key once
  placement enforces the owner.
- **Row locks on the new parent's ancestor chain.** Two moves that could close a cycle always share
  a locked row. But every chain ends at the root, so this serializes per tree anyway, and lock-order
  deadlocks have to be retried.
- **`SERIALIZABLE` isolation.** Postgres detects the write skew, but the loser gets a serialization
  failure that every caller has to retry.
- **A trigger that rejects a cycle.** The trigger itself races the same way unless it takes a lock,
  and it hides the rule from the code.

## Decision

- **`StorageObjectRepository.withTreeLock(work)`** runs `work` in one `em.transactional` with
  `clear: true`. The transaction first takes `pg_advisory_xact_lock(hashtext('storage-objects.tree'))`,
  one key for every user's tree.
  - Repository calls inside `work` join that transaction through MikroORM's transaction context.
    The nested `updateAndCascadePublic` becomes a savepoint.
  - A `left` from `work` rolls the transaction back.
  - The lock is transaction-scoped, so a commit or a rollback releases it.
- **`StorageObjectUpdateOneUseCase` and `StorageObjectDeleteOneUseCase` run their whole
  read-check-write inside it.**
  - A move reads the tree only after every earlier tree write has committed.
  - A move also takes its new parent's `isPublic` after any visibility change queued before it.
  - A deletion's subtree cannot change between the read and the mark.
- **`getAllChildrenIds` returns `Either`.** A failed walk refuses the move and fails `getFolders`,
  instead of offering the folder's own subtree in the picker.

## Consequences

- **All users share one queue.** Moves, visibility changes and deletions of every user wait for one
  another. Each is an admin action of a few milliseconds, so the queue is not measurable at this
  scale. A waiter holds its pool connection while it waits, so a burst of parallel tree writes could
  use up the pool and stall reads.
- **Creates do not take the lock.** This covers `StorageObjectCreateOneUseCase` and the media
  `saveAndPlaceOne`. A create cannot close a cycle. But it reads its parent's `isPublic` outside the
  lock, so a create that races a visibility change of an ancestor can keep the old value. The same
  holds for a create that races the deletion of its parent. Moving placement under the lock belongs
  with the owner check, which is also what would allow a per-user key.
- **`test/storage-object.tree.e2e-spec.ts` covers the lock.** A second write queues (seen in
  `pg_locks`), two opposite moves let one through and refuse the other, and a `left` rolls back.
  Without the lock statement, the first two fail.
- **Relation to [0018](0018-folder-paths-computed-on-read.md).** 0018 made every walk survive a
  cycle. This decision stops the service from creating one, so only a row written outside the
  service can still close one.
