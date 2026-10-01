import { readdir, readFile } from 'fs/promises';
import { join, sep } from 'path';
import { PNPM_WORKSPACE_FILE, WORKSPACE_MANIFEST } from './constants';
import { WorkspaceModel } from './models';

/** The `packages:` block of `pnpm-workspace.yaml`, up to the next top-level key. */
const PACKAGES_KEY = 'packages:';
const GLOB_REG_EXP = /^\s*-\s*'?"?(.+?)'?"?\s*$/;
const GLOB_SUFFIX = `${sep}*`;

/**
 * Reads the workspace roots from `pnpm-workspace.yaml` rather than repeating them here.
 *
 * A hand-copied list of roots is exactly the kind of second copy this package exists to remove:
 * a new root added to the workspace file would silently stay outside every check below.
 */
const readRoots = async (repositoryRoot: string): Promise<string[]> => {
  const file = await readFile(join(repositoryRoot, PNPM_WORKSPACE_FILE), { encoding: 'utf-8' });
  const roots: string[] = [];
  let inside = false;

  for (const line of file.split('\n')) {
    if (line.startsWith(PACKAGES_KEY)) {
      inside = true;
      continue;
    }

    if (!inside || !line.trim() || line.trim().startsWith('#')) {
      continue;
    }

    const glob = GLOB_REG_EXP.exec(line);

    // The first entry that is not a list item closes the block — the next top-level key.
    if (!glob) {
      break;
    }

    const directory = join(repositoryRoot, glob[1]);

    if (!directory.endsWith(GLOB_SUFFIX)) {
      throw new Error(`${PNPM_WORKSPACE_FILE}: unsupported workspace glob \`${glob[1]}\``);
    }

    roots.push(directory.slice(0, -GLOB_SUFFIX.length));
  }

  if (!roots.length) {
    throw new Error(`${PNPM_WORKSPACE_FILE}: no \`${PACKAGES_KEY}\` entries`);
  }

  return roots;
};

const readManifest = async (directory: string): Promise<WorkspaceModel | null> => {
  let manifest: { name?: string; dependencies?: Record<string, string> };

  try {
    manifest = JSON.parse(
      await readFile(join(directory, WORKSPACE_MANIFEST), { encoding: 'utf-8' }),
    );
  } catch {
    return null;
  }

  if (!manifest.name) {
    return null;
  }

  return {
    name: manifest.name,
    directory,
    // Runtime dependencies only: env is validated when a config module is imported, and a
    // devDependency is not part of what a deployed process loads.
    dependencies: Object.keys(manifest.dependencies ?? {}),
    isApp: !manifest.name.includes('/'),
  };
};

/** Every workspace of the monorepo, keyed by nothing — callers index it as they need. */
export const readWorkspaces = async (repositoryRoot: string): Promise<WorkspaceModel[]> => {
  const roots = await readRoots(repositoryRoot);

  const found = await Promise.all(
    roots.map(async (root) => {
      const entries = await readdir(root, { withFileTypes: true });

      const workspaces = await Promise.all(
        entries
          .filter((entry) => entry.isDirectory())
          .map((entry) => readManifest(join(root, entry.name))),
      );

      return workspaces.filter((workspace): workspace is WorkspaceModel => Boolean(workspace));
    }),
  );

  return found.flat().sort((left, right) => left.name.localeCompare(right.name));
};

/** The workspace a file belongs to — the deepest directory the path sits under. */
export const findWorkspace = (
  workspaces: WorkspaceModel[],
  filePath: string,
): WorkspaceModel | undefined =>
  workspaces
    .filter((workspace) => filePath.startsWith(workspace.directory + sep))
    .sort((left, right) => right.directory.length - left.directory.length)[0];

/**
 * Every workspace reachable from `name`, itself excluded.
 *
 * The closure rather than the direct dependencies: a package pulled in through an intermediary
 * still has its config module imported, and still demands its variables.
 */
export const collectDependencies = (workspaces: WorkspaceModel[], name: string): string[] => {
  const index = new Map(workspaces.map((workspace) => [workspace.name, workspace]));
  const reached = new Set<string>();
  const queue = [...(index.get(name)?.dependencies ?? [])];

  while (queue.length) {
    const next = queue.shift() as string;

    if (reached.has(next) || next === name || !index.has(next)) {
      continue;
    }

    reached.add(next);
    queue.push(...(index.get(next) as WorkspaceModel).dependencies);
  }

  return [...reached].sort();
};
