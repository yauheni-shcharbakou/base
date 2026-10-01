import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { DOC_EXTENSION, MARKER_END_REG_EXP, MARKER_START_REG_EXP, SKIPPED_DIRS } from './constants';
import { MarkerKind, MarkerModel } from './models';

/** Walks the repository for documentation files, skipping what is never worth descending into. */
export const findDocs = async (root: string): Promise<string[]> => {
  const found: string[] = [];

  const walk = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });

    await Promise.all(
      entries.map(async (entry) => {
        if (entry.isDirectory()) {
          if (!SKIPPED_DIRS.has(entry.name)) {
            await walk(join(directory, entry.name));
          }

          return;
        }

        if (entry.name.endsWith(DOC_EXTENSION)) {
          found.push(join(directory, entry.name));
        }
      }),
    );
  };

  await walk(root);
  return found.sort();
};

/**
 * Locates the marked regions of a document.
 *
 * An opening marker without its closing counterpart is an error rather than a skip: the
 * generator would otherwise silently leave a half-written table in place.
 */
export const findMarkers = (lines: string[], docPath: string): MarkerModel[] => {
  const markers: MarkerModel[] = [];
  let open: { kind: MarkerKind; specs: string[]; startLine: number } | null = null;
  let fenced = false;

  // A plain loop rather than `forEach`: the closure would hide every assignment to `open` from
  // control-flow analysis, and the never-closed check below would narrow to `never`.
  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();

    // A fenced block is where the marker syntax is documented, not used.
    if (trimmed.startsWith('```')) {
      fenced = !fenced;
      continue;
    }

    if (fenced) {
      continue;
    }

    const start = MARKER_START_REG_EXP.exec(trimmed);

    if (start) {
      if (open) {
        throw new Error(`${docPath}:${index + 1}: nested env marker`);
      }

      const kind = start[1] as MarkerKind;
      const specs = (start[2] ?? '').split(',').filter(Boolean);

      // A table without sources has nothing to project; the service map reads the workspace
      // manifests, so a `src=` on it would name files it never opens.
      if (kind === 'table' && !specs.length) {
        throw new Error(`${docPath}:${index + 1}: env-table:start without \`src=\``);
      }

      if (kind === 'services' && specs.length) {
        throw new Error(`${docPath}:${index + 1}: env-services:start takes no \`src=\``);
      }

      open = { kind, specs, startLine: index };
      continue;
    }

    const end = MARKER_END_REG_EXP.exec(trimmed);

    if (end) {
      if (!open) {
        throw new Error(`${docPath}:${index + 1}: env-${end[1]}:end without a start`);
      }

      if (end[1] !== open.kind) {
        throw new Error(`${docPath}:${index + 1}: env-${open.kind}:start closed by env-${end[1]}`);
      }

      markers.push({ ...open, endLine: index });
      open = null;
    }
  }

  if (open) {
    throw new Error(`${docPath}:${open.startLine + 1}: env-${open.kind}:start is never closed`);
  }

  return markers;
};

/** Replaces the bodies of every marked region, leaving the markers and the prose untouched. */
export const spliceMarkers = (
  lines: string[],
  markers: MarkerModel[],
  bodies: string[],
): string[] => {
  const result = [...lines];

  // Back to front, so an earlier splice does not shift the indexes of a later one.
  for (let index = markers.length - 1; index >= 0; index -= 1) {
    const { startLine, endLine } = markers[index];

    // Blank lines around the body: a markdown table pressed against an HTML comment is not
    // parsed as a table.
    const body = ['', ...bodies[index].split('\n'), ''];
    result.splice(startLine + 1, endLine - startLine - 1, ...body);
  }

  return result;
};

export const readDoc = async (docPath: string): Promise<string> =>
  readFile(docPath, { encoding: 'utf-8' });
