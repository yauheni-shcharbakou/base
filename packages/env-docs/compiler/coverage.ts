import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import {
  SKIPPED_DIRS,
  SOURCE_DIR,
  SPEC_SUFFIX,
  TS_EXTENSION,
  VALIDATE_ENV_CALL_REG_EXP,
} from './constants';
import { WorkspaceModel } from './models';
import { EnvSchemaParser } from './parser';

/**
 * Every file that actually calls `validateEnv`.
 *
 * Only `src/` of each workspace is walked, so this compiler's own `compiler/` — which talks about
 * `validateEnv` in comments and constants — is out of scope without an exclusion list to maintain.
 * Within that, a cheap text match narrows hundreds of files to a handful, and the AST decides:
 * matching text would also flag the helper's own declaration and every mention in a comment.
 */
export const findEnvSources = async (
  workspaces: WorkspaceModel[],
  parser: EnvSchemaParser,
): Promise<string[]> => {
  const candidates: string[] = [];

  const walk = async (directory: string): Promise<void> => {
    // A workspace without sources — `@packages/configs` is presets, this package is a CLI.
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);

    await Promise.all(
      entries.map(async (entry) => {
        const path = join(directory, entry.name);

        if (entry.isDirectory()) {
          if (!SKIPPED_DIRS.has(entry.name)) {
            await walk(path);
          }

          return;
        }

        if (!entry.name.endsWith(TS_EXTENSION) || entry.name.endsWith(SPEC_SUFFIX)) {
          return;
        }

        const content = await readFile(path, { encoding: 'utf-8' });

        if (VALIDATE_ENV_CALL_REG_EXP.test(content)) {
          candidates.push(path);
        }
      }),
    );
  };

  await Promise.all(workspaces.map((workspace) => walk(join(workspace.directory, SOURCE_DIR))));

  return candidates.filter((path) => parser.callsValidateEnv(path)).sort();
};
