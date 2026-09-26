# 0016 — Provider objects are purged over the event bus, and deleted storage objects are swept by a cron

**Status:** Accepted (2026-09-26)
**Applies to:** `backend.storage`, `@backend/event-bus`, `@backend/event-bus-redis`

## Context

Six paths in `backend.storage` delete a provider object:
- file delete;
- image delete;
- video delete;
- `completeUpload` on a size mismatch;
- the failed-encode branch of the Bunny Stream webhook;
- the stale-upload cleanup cron.

Each called `StorageFileService.deleteFile` or `StorageVideoService.deleteVideo` inline and ignored the `Either`. A provider that refused a delete, even over a network blip, left an object that nothing referenced any more. Its row was already gone, so nothing would ever retry the delete.

The storage-object tree had the opposite problem. `StorageObjectDeleteOneUseCase` set `isDeleted` on one row, purged the provider inline, and stopped there:
- The `files`, `images` and `videos` rows survived forever and kept appearing in their own lists with dead links.
- No cron ever looked at `isDeleted`.
- A folder that still had children could not be deleted. The emptiness check counted children that were already marked deleted, so such a folder stayed stuck.

The soft delete exists so that a folder and everything under it can be deleted in one statement. It is not meant to be undone.

Rejected alternatives:

- **Keep purging inline, with a retry loop in place.** A retry loop inside a request only survives the request. A crash, a deploy or an outage longer than the loop still orphans the object.
- **A transactional outbox.** It would close the gap between the row delete and the emit, but it needs a table, a relay and its own cleanup. For a personal site's media that gap is an accepted cost; see Consequences.
- **Hard-deleting the storage-object tree synchronously.** A deep folder means a large cascade inside one gRPC call. The soft-delete mark was built so that this work leaves the request.

## Decision

- **One event, `storage.file.purge`, with the payload `FilePurgeEvent { type: FilePurgeType; providerId }`.**
  - `type` names the kind of object: `FILE` for a plain file or an image, `VIDEO` for a video. It never names the provider, so which store holds which kind stays the consumer's business.
  - Each event describes one object, so every object has its own retry ladder.
- **The storage module consumes it.** `RedisStorageController` (consumer id `storage.storage`) calls `StoragePurgeUseCase`, which picks the adapter by `type`. On a `left` the controller throws, so BullMQ retries the job up to its limit and then moves it to the DLQ. The handler never touches the database.
- **Purges are emitted only after the rows are gone,** through `FilePurgeService` in the file module.
  - `purgeFiles` maps a deleted file row to its object: `video.providerId` becomes `VIDEO`, otherwise `file.providerId` becomes `FILE`.
  - Every one of the six paths emits through it.
  - `FileDeleteUseCase` now reads the `video` relation before it deletes. A file that backs a video takes the video row with it through the cascade, and the video's own id is the only way to reach its Stream object.
- **Deletes are idempotent at the provider.** A missing S3 key already answers 204. `deleteVideo` treats a Stream 404 as success, so a redelivered purge does not burn its attempts.
- **Deleting a storage object only marks it.** `markDeletedWithDescendants` flags the object and its whole subtree in one recursive `UPDATE`. The root folder stays undeletable, and non-empty folders are now allowed.
- **Two crons, every 10 minutes, remove what was marked.**
  - `FileCleanupUseCase` gains a second sweep: files whose storage object is deleted. It deletes the file rows, which cascade to the image or video row and the leaf storage object, then purges.
  - `StorageObjectCleanupUseCase` deletes deleted folders that have no children left. It repeats until a pass finds none, so the tree is removed leaves first. Deleting a parent before its children is unsafe: `parent_id` is `on delete set null`, which would turn a subfolder into a second root and trip the root-folder unique index.
  - Both sweeps cap a run at 500 rows.
- **`storage.image.delete` is removed.** It had no consumer and only ever accumulated in the parking list ([ADR-0005](0005-parking-unrouted-events.md)).

## Consequences

- **A refused provider delete is retried** instead of leaving an orphan behind. What cannot be retried lands in the DLQ with the object's key, where it can still be found.
- **The gap between the row delete and the emit remains.** If Redis is unreachable at that moment, the emit fails loudly ([ADR-0013](0013-event-bus-fails-loud.md)) and is logged with the keys, but the object stays at the provider. The reverse order would be worse: a purge that runs ahead of a delete that then fails leaves a row with nothing behind it.
- **Deleted media stays in the lists until the next sweep.** It leaves the tree at once, but `files`, `images` and `videos` do not filter on the tree's mark. The 10-minute interval is what keeps that gap short. Filtering those lists by a join was judged not worth it.
- **Provider load follows the queue, not the sweep.** A deleted folder of thousands of files becomes thousands of jobs drained at the worker's concurrency, which stays well under the zone's request limit ([ADR-0015](0015-file-uploads-presigned-s3-put.md)).
