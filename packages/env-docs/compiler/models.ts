/** One environment variable, already rendered into the cells a table row needs. */
export type EnvVariableModel = {
  name: string;
  /** `integer > 0`, `` `all` \| `new` ``, `string` … */
  type: string;
  /** A backticked literal, `—` for optional-and-unset, or `**required**`. */
  defaultValue: string;
  /** Basename of the config file the variable is declared in. */
  source: string;
};

/** The result of parsing one `validateEnv` argument (or one named exported shape). */
export type EnvSchemaModel = {
  /** Path of the parsed file, relative to the repository root. */
  source: string;
  variables: EnvVariableModel[];
  /** Names of shared shapes spread into the schema — documented by their own owner. */
  references: string[];
};

/**
 * A `zod.number()` / `zod.boolean()` that never reaches its own validator: `process.env` values
 * are strings, so the variable parses only while it is unset and its default applies.
 */
export type CoercionViolation = {
  source: string;
  name: string;
  base: string;
};

/**
 * What a marked region is a projection of: the variables of some config files (`table`), or the
 * map of which packages' env a service inherits, read off the workspace manifests (`services`).
 */
export type MarkerKind = 'table' | 'services';

/** One `<!-- env-<kind>:start … -->` … `<!-- env-<kind>:end -->` region. */
export type MarkerModel = {
  kind: MarkerKind;
  /** Source specs exactly as written in the marker: `path.ts` or `path.ts#ExportName`. */
  specs: string[];
  /** Line indexes of the opening and closing comments. */
  startLine: number;
  endLine: number;
};

/** One workspace of the pnpm monorepo, as its manifest declares it. */
export type WorkspaceModel = {
  /** `@backend/pg`, `backend.auth` … */
  name: string;
  /** Absolute path of the directory holding the manifest. */
  directory: string;
  /** Names of the other workspaces it depends on — external packages are dropped. */
  dependencies: string[];
  /**
   * A deployable app rather than a library. The repository names apps `backend.auth` and libraries
   * `@backend/pg`, so the absence of a `/` is the convention itself, not a heuristic over it.
   */
  isApp: boolean;
};

/** One row of the service table: what an app has to be given beyond its own variables. */
export type EnvServiceModel = {
  name: string;
  /** Env-declaring workspaces in its dependency closure, sorted. */
  packages: string[];
};
