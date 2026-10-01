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
- **Trying a failing row forever.** With the cursor it holds nothing back, but an original whose
  stream breaks every time is downloaded again every sweep, up to 100 MB of it, for good.
- **Counting the attempts in `ImageMakePreviewUseCase`** — the event handler runs it too, and
  BullMQ's ten retries of one event would spend a cap meant for hours within minutes.
- **Counting every failure, outage or not.** The count cannot tell a provider that is down from a
  row that is broken, and during a backfill every row fails once per sweep: an outage longer than
  the cap would give up on the whole backlog.
- **Telling the outage by a batch in which everything failed** — a stuck row alone in the backlog
  is such a batch, and it is the case the cap is for. Ten in a row is not something one row makes.
- **Any `right` ending a run of failures.** A light original or an SVG is recorded without a word
  to the provider, so a backlog that mixes them with heavier images would never fail ten in a row
  while the provider is down.
- **A run carried from one batch into the next.** The failures a batch ends with would be held back
  uncounted, and the scheduler would have to count them when the budget ends the sweep there — a
  second call in each scheduler, for a few rows counted once more or once less.

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
- **A row is given up on after `*_PREVIEW_SWEEP_MAX_ATTEMPTS` sweeps**, 12 by default, 0 for never.
  The sweep, not the use case it calls, counts a `left` in `images.preview_attempts` /
  `files.preview_attempts` through `countPreviewAttempt`: one `UPDATE` that adds one and, at the
  cap, sets `preview_failed_at` — only over neither a preview nor a mark, like every other write of
  these columns. It leaves `updated_at` alone, which a file's grace is measured from.
- **Ten failures in a row stop the sweep, and are not counted.** A `left` is held back rather than
  counted at once. `*_PREVIEW_SWEEP_BREAKER_THRESHOLD` of them in a row within a batch — 10 by
  default, 0 for never — are read as the provider or the database being down: the use case counts
  none of them and answers nothing, which ends the sweep. A row the provider answered for ends the
  run, and those held back are counted then; whatever a batch ends with is counted at its end.
- **Only the provider's answer ends a run.** `ImageMakePreviewUseCase` and
  `DocumentMakePreviewUseCase` answer `right(true)` when the original was read or found missing,
  `right(false)` when nothing was asked of the provider — a light original, an SVG, a document too
  heavy to draw, a row with nothing to make. The sweep leaves the run as it is over a `false`.

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
- **A row that keeps failing costs one attempt per sweep**, delays nothing behind it, and stops
  after the cap: two hours at the least by default, since sweeps are 10 minutes apart or more.
- **An outage costs a sweep ten requests and a row nothing** — while the backlog holds ten rows
  that ask the provider. The next sweep starts with the same ten, so a backlog waits an outage out
  where it stood.
- **A backlog shorter than the threshold is still counted through an outage**, and one longer than
  the cap gives up on those few rows. They are told apart afterwards: a row the cap gave up on has
  `preview_attempts` at the cap or over, one a retry cannot help has fewer. Both columns are
  cleared to queue them again:
  `update images set preview_failed_at = null, preview_attempts = 0 where preview_attempts >= 12`,
  and the same for `files`.
- **Ten rows that fail every time, next to each other in the backlog, stop every sweep where they
  are.** They are never counted, so the cap never reaches them, and nothing past them is taken —
  the head held back again, by the breaker this time. A `left` is the provider, the database or a
  stream that breaks, so it takes ten originals that break on every read; the log says at each tick
  that the sweep stopped. Set the threshold to 0 until the cap has given up on them.
- **The breaker needs a batch as long as its threshold.** A run does not carry into the next batch,
  so a threshold over `*_PREVIEW_SWEEP_LIMIT` never stops a sweep — the use case warns of it when
  the service starts — and the failures one batch ends with are counted even when the next opens
  with ten more.
- **The count is never reset by the service.** It is the sum of a row's failed sweeps, not a run of
  them, and a row that gets its preview keeps the number it had.
- **Rows the sweep has passed are not seen again until the next one** — an image that turns READY
  with an older id than the cursor, which a ULID makes rare, waits a tick.
- **The overlap flag is per process**, as before: two replicas sweep the same rows side by side,
  and the conditional write of 0027 is what keeps that harmless.
