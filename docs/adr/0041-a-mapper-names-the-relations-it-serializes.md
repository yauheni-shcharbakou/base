# 0041 — A mapper names the relations it serializes; every other relation is its key

**Status:** Accepted (2026-10-08)
**Applies to:** `@backend/pg`, `backend.storage`, `backend.auth`

## Context

`PgMapper.stringify` was `wrap(entity).toJSON()`, and every repository answers through it. `toJSON`
expands each relation that is _loaded_ — and whether it is loaded is decided by the identity map,
not by the read: anything else the request touched in the same EntityManager counts. So the shape
of an answer depended on the request's history rather than on its contract, and that went wrong
twice:

- **Storage, n².** A media batch placed in a folder the EntityManager already held: the unit of
  work fills that folder's `children` with every leaf it inserts, and serializing each leaf followed
  its storage object into the folder and through every sibling there. A hundred images took 30 s, a
  hundred videos 60 s, and a few hundred ran the process out of memory. `PgStorageObjectMapper` had
  already patched the same trap for `parent`/`children` with `toObject(ignoreFields)`.
- **Auth, a leak.** A temp code or a session whose user was loaded in the same EntityManager
  serialized that user whole, password `hash` included. The proto messages carry no `user`, so
  nothing reached the wire, but the service held it. `PgUserMapper` omitted `['hash', 'tempTokens']`
  — the collection is `tempCodes` — so a fresh user's `tempCodes: []` went into the identity cache.

Rejected alternatives:

- **A `serialize` override in each mapper that has a relation** — the first fix in storage. It works,
  but the base stays a trap for the next mapper with a relation, and each override repeats the same
  cast.
- **`toObject(ignoreFields)`** — cuts the named properties at the top level only, and still expands
  every loaded relation it was not told about.
- **`hidden` / `serializedName` on the entity** — entity-wide, so a relation could not be an object
  in one contract (`ImagePopulated`) and absent in another, and it hides a property rather than
  stopping the walk into a relation.

## Decision

`PgMapper.stringify` is MikroORM's `serialize(entity, { populate, exclude })`. A subclass declares
`protected readonly populate` — the relations a contract carries as objects, at any depth, expanded
only where the read loaded them — and `protected readonly exclude` — properties never visited, at
any depth. Every other relation serializes as its key, whatever the identity map holds. No mapper
overrides `stringify`.

The declarations today: `PgFileMapper` populates `image`/`video`, `PgImageMapper`/`PgVideoMapper`
`file`, `PgStorageObjectMapper` `file`/`image`/`video`, each excluding `storageObject`, `parent`,
`children` and the populated relations' back-references; `PgUserMapper` excludes `hash` and
`tempCodes`; the temp-code and session mappers declare nothing, so `user` is its id. A lazy formula
(`folderPath`, `folderStats`) needs no entry: `serialize` writes a lazy scalar wherever the read
loaded it.

## Consequences

- An answer is a function of the read and the mapper. A new relation is a key until a mapper names
  it, so a forgotten entry shows up as an id where the contract wanted an object — a visible bug —
  rather than as an unbounded walk or a leaked column.
- Every relation a contract carries as an object must be declared; a read that `populate`s one the
  mapper does not name gets its key.
- The paths are not type-checked. The relations are typed as proto interfaces, which have nothing
  past them, so `AutoPath` rejects valid paths and the base casts the options once. A misspelt
  `exclude` silently cuts nothing — the old `tempTokens` was exactly that. The storage e2e
  `test/storage.media-serialization.e2e-spec.ts` holds the media paths; auth has no e2e to hold its.
