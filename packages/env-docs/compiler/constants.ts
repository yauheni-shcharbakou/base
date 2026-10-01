import { join } from 'path';

export const REPOSITORY_ROOT = join(__dirname, '..', '..', '..');

/** The call whose argument is the single source of truth for a service's environment. */
export const VALIDATE_ENV_CALLEE = 'validateEnv';

/** `validateEnv(` as a call rather than a mention: a declaration or a comment must not match. */
export const VALIDATE_ENV_CALL_REG_EXP = /(?<![\w$.])validateEnv\s*\(/;

export const MARKER_START_REG_EXP = /^<!--\s*env-(table|services):start(?:\s+src=(\S+))?\s*-->$/;
export const MARKER_END_REG_EXP = /^<!--\s*env-(table|services):end\s*-->$/;

export const DOC_EXTENSION = '.md';
export const SOURCE_DIR = 'src';
export const SPEC_SUFFIX = '.spec.ts';
export const TS_EXTENSION = '.ts';

/** Directories never worth walking, either for documentation or for sources. */
export const SKIPPED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'generated',
  '.git',
  '.turbo',
  '.next',
  '.claude',
  '.idea',
]);

/** Owner of the workspace roots — the same globs pnpm resolves. */
export const PNPM_WORKSPACE_FILE = 'pnpm-workspace.yaml';
export const WORKSPACE_MANIFEST = 'package.json';

export const GENERATE_COMMAND = 'pnpm compile:env-docs';

/** Where the shared zod shapes live, for the reference line a spread renders as. */
export const SHARED_SCHEMA_PACKAGE = '@packages/common';
