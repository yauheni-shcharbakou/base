---
name: adr
description: Write an Architecture Decision Record into docs/adr/. Use when a structural decision has just been made or is being reversed — a broker or library swap, a codegen/build-topology change, a naming or layering rule, a trade-off that will look arbitrary in six months. Also use when asked to "record this decision", "write an ADR", or when trimming rationale out of a CLAUDE.md and it needs somewhere to live.
---

# Writing an ADR

An ADR is a **dated record of why**, immutable once merged. A `CLAUDE.md` is a **live instruction**,
rewritten whenever reality changes. Keep the rule in `CLAUDE.md` and the reasoning here — never both.

## When it is worth one

Write an ADR when the decision has a **losing alternative worth naming**: something a future reader
would otherwise re-propose. Broker/library swaps, build-topology changes, naming schemes with a
trap, layering rules, deliberate asymmetries between two similar packages.

Do **not** write one for: a fact with no alternative ("BullMQ forbids `:` in queue names" — that is a
constraint, it belongs in the `CLAUDE.md`), a routine dependency bump, or a decision already covered
by an existing ADR (extend the rule in `CLAUDE.md` instead).

## Steps

1. **Pick the number.** `ls docs/adr/` — take the highest and add one, zero-padded to four digits.
   Numbers are never reused, even by superseded or rejected ADRs.
2. **Write `docs/adr/NNNN-kebab-slug.md`** using the template below. English, like all documentation
   in this repo.
3. **Update the index** in `docs/adr/README.md` — one table row: number, linked title, status,
   packages.
4. **Link it from the owning `CLAUDE.md`.** Find the file that states the *rule* this ADR explains,
   and add a blockquote line right after it:
   ```markdown
   > **Why parking and not dropping:** [docs/adr/0005-parking-unrouted-events.md](../../../docs/adr/0005-parking-unrouted-events.md)
   ```
   Get the relative depth right — `backend/packages/x/CLAUDE.md` needs `../../../docs/adr/…`.
5. **Then cut the prose.** If the reasoning was living in the `CLAUDE.md`, delete it there now,
   leaving the rule plus the link. This step is the point of the exercise — an ADR that merely
   duplicates a `CLAUDE.md` section makes things worse, not better.

## Superseding

Never rewrite a landed ADR. Write a new one whose status reads `Accepted (date), supersedes 000N`,
then edit **only** the old one's status line to `Superseded by 000M (date)`. Update both rows in the
index, and repoint the `CLAUDE.md` link at the new ADR.

## Template

```markdown
# NNNN — <decision, as a statement, not a question>

**Status:** Accepted (YYYY-MM-DD)
**Applies to:** <packages, comma-separated>

## Context

What forced a choice. Include the constraint that made the obvious option fail — that is usually the
whole reason the ADR exists. Name the alternatives that were rejected and why.

## Decision

What was chosen, in the present tense. Concrete enough to check against the code: names of the
classes, files, env vars or identifiers involved.

## Consequences

What this costs, what it enables, and what traps it leaves for whoever comes next. Cross-link related
ADRs by number.
```
