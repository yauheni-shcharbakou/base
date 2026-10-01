# 0037 — A preview sweep takes batch after batch within a time budget, from a cursor

**Status:** Accepted (2026-10-02), supersedes 0027 in part (how much one sweep takes on)
**Applies to:** `backend.storage`

## Context

[ADR-0027](0027-image-preview-made-on-upload.md) gave images a sweep that takes up to 20 of them
every 10 minutes, and [ADR-0032](0032-pdf-preview-drawn-by-pdfjs-in-a-worker.md) gave PDFs the same
one. One query, one batch, one MikroORM context per tick. Three things were wrong with that:

- **The pace was a constant.** 120 an hour, so a backlog of a few thousand took a day, and going
  faster meant a release. Moving the limit to env made it a setting, but one to be guessed: too low
  is slow, and nothing says what too high is.
- **A batch that fails holds the sweep back for good.** The query reads the oldest rows first, with
  no memory of where the last sweep stopped. An image whose preview fails with a retryable `left` —
  the provider, a stream that breaks mid-read — is still without one, so it is read again next
  time, first. A limit's worth of such rows is all the sweep ever reads.
- **One context for the whole sweep.** Fine for 20 rows; a long sweep would keep every row it read
  in the identity map, and answer a later read of a row from that copy.

Rejected alternatives:

- **A high limit and nothing else.** The overlap flag already makes a long sweep safe, so
  `LIMIT=5000` drains a backlog almost as fast. It leaves the limit to be guessed, the rows that
  fail at the head, and 5000 rows in one context.
- **A loop without a cursor**, reading "the oldest without a preview" until none is left — it reads
  the failing rows again at once, and spends its whole budget on them.
- **The loop in the use case.** A context per batch then needs `DatabaseRunnerService` in the
  application layer and a `RequestContext` nested in the scheduler's. The scheduler already owns
  how a sweep is run: when, in what context, and never two at once.
- **The budget checked between items.** A budget of 0 would then take nothing, where between
  batches it takes one batch — what a sweep did before, with no second mode to switch to.
- **A shorter cron** — more ticks, the same blocked head, and the interval is not the limit: a tick
  is skipped while a sweep runs.

## Decision

- **A use-case call is one batch.** `ImageSweepPreviewsUseCase.execute(afterId?)` and
  `DocumentSweepPreviewsUseCase.execute(afterId?)` read up to `*_PREVIEW_SWEEP_LIMIT` rows past
  `afterId`, make their previews one after another, and answer the last row's id when the batch was
  full, nothing when the backlog ended in it.
- **The cursor is the row id.** `getManyWithoutPreview` of both repositories takes an optional
  `afterId` and adds `id > afterId` to the same query, ordered by id. Ids are ULIDs, so the order
  is the order of creation.
- **The scheduler loops.** `CronImageScheduler` and `CronDocumentScheduler` call the use case again
  with the id it answered, each call in its own `isolatedRun`, while there is a cursor and the
  budget lasts. The first batch runs whatever the budget.
- **The budget is env's**: `STORAGE_IMAGE_PREVIEW_SWEEP_BUDGET_MINUTES` and
  `STORAGE_DOCUMENT_PREVIEW_SWEEP_BUDGET_MINUTES`, 8 by default, read once per scheduler. 0 is one
  batch a tick. There is no upper bound: past 10, the ticks in between are skipped.
- **A sweep starts from the beginning.** The cursor lives for one sweep, so a row that failed is
  tried once per sweep, not once per batch.

## Consequences

- **A backlog drains by itself**, at the pace of the renders: about 8 of every 10 minutes are spent
  on it, with nothing to tune. In the steady state there is no backlog and a sweep is one short
  batch, as before.
- **The service renders for most of an hour during a backfill**, one image and one PDF at a time —
  the peak of 0027 and 0032 is unchanged, it just lasts. The two sweeps tick together and do not
  wait for each other. Lower a budget to give the service room, 0 to go back to a batch a tick.
- **The limit is a batch size now, not a pace.** It bounds what one context holds and how far a
  sweep runs past its budget, since a batch is never cut short. Raising it no longer speeds
  anything up.
- **A row that keeps failing costs one attempt per sweep** and delays nothing behind it. It is
  still tried forever: only a failure a retry cannot fix sets `preview_failed_at`.
- **Rows the sweep has passed are not seen again until the next one** — an image that turns READY
  with an older id than the cursor, which a ULID makes rare, waits a tick.
- **The overlap flag is per process**, as before: two replicas sweep the same rows side by side,
  and the conditional write of 0027 is what keeps that harmless.
