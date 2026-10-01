import { writeFile } from 'fs/promises';
import { relative, resolve } from 'path';
import { GENERATE_COMMAND, REPOSITORY_ROOT } from './constants';
import { findEnvSources } from './coverage';
import { findDocs, findMarkers, readDoc, spliceMarkers } from './markers';
import { EnvSchemaModel, EnvServiceModel, MarkerModel, WorkspaceModel } from './models';
import { EnvSchemaParser } from './parser';
import { EnvTableRenderer } from './renderer';
import { collectDependencies, findWorkspace, readWorkspaces } from './workspaces';

/**
 * Rewrites the env tables of every document that asks for one from the zod schemas they are
 * generated out of, and reports what the tables cannot say themselves.
 *
 * The zod schema is the owner of a variable's name, type, default and whether it is required.
 * Documentation restating those values by hand is a second copy that nothing keeps honest —
 * this replaces the copy with a marked region and `--check` makes a divergence fail loudly.
 */
type DocumentModel = {
  path: string;
  source: string;
  original: string;
  lines: string[];
  markers: MarkerModel[];
};

// Repository-relative, not relative to the document: every table now lives in one file, and a
// pile of `../../../backend/packages/…` would be unreadable there.
const parseSpec = (spec: string): { filePath: string; exportName?: string } => {
  const [path, exportName] = spec.split('#');
  return { filePath: resolve(REPOSITORY_ROOT, path), exportName };
};

const readDocuments = async (): Promise<DocumentModel[]> => {
  const documents: DocumentModel[] = [];

  for (const path of await findDocs(REPOSITORY_ROOT)) {
    const original = await readDoc(path);
    const lines = original.split('\n');
    const source = relative(REPOSITORY_ROOT, path);
    const markers = findMarkers(lines, source);

    if (markers.length) {
      documents.push({ path, source, original, lines, markers });
    }
  }

  return documents;
};

/**
 * Which app needs which package's variables, and which env-declaring package no app reaches.
 *
 * A package counts as declaring env when a marker tabulates a `validateEnv` call of its own — a
 * marker addressing a named shape (`@packages/common`) does not, because those variables are
 * already reported through whichever package spreads them.
 */
const buildServices = (
  workspaces: WorkspaceModel[],
  declaring: Set<string>,
): { services: EnvServiceModel[]; dormant: string[] } => {
  const apps = workspaces.filter((workspace) => workspace.isApp);
  const services: EnvServiceModel[] = [];
  const wired = new Set(apps.map((app) => app.name));

  for (const app of apps) {
    const packages = collectDependencies(workspaces, app.name).filter((name) =>
      declaring.has(name),
    );

    packages.forEach((name) => wired.add(name));
    services.push({ name: app.name, packages });
  }

  const dormant = [...declaring].filter((name) => !wired.has(name)).sort();

  return { services, dormant };
};

const compile = async (): Promise<void> => {
  const check = process.argv.includes('--check');
  const parser = new EnvSchemaParser();
  const renderer = new EnvTableRenderer();

  const workspaces = await readWorkspaces(REPOSITORY_ROOT);
  const documents = await readDocuments();

  // Pass one: parse every table marker. The service map is a projection of all of them at once,
  // so nothing can be rendered until the last document has been read.
  const schemas = new Map<string, EnvSchemaModel>();
  const covered = new Set<string>();

  for (const document of documents) {
    for (const marker of document.markers) {
      for (const spec of marker.specs) {
        const { filePath, exportName } = parseSpec(spec);

        if (!schemas.has(spec)) {
          schemas.set(spec, parser.parse(filePath, exportName));
        }

        if (!exportName) {
          covered.add(filePath);
        }
      }
    }
  }

  const declaring = new Set(
    [...covered]
      .map((path) => findWorkspace(workspaces, path)?.name)
      .filter((name): name is string => Boolean(name)),
  );

  const { services, dormant } = buildServices(workspaces, declaring);

  // Pass two: render and splice.
  const changed: string[] = [];

  for (const document of documents) {
    const bodies = document.markers.map((marker) =>
      marker.kind === 'services'
        ? renderer.renderServices(services, dormant)
        : renderer.renderVariables(marker.specs.map((spec) => schemas.get(spec) as EnvSchemaModel)),
    );

    const updated = spliceMarkers(document.lines, document.markers, bodies).join('\n');

    if (updated === document.original) {
      continue;
    }

    changed.push(document.source);

    if (!check) {
      await writeFile(document.path, updated, { encoding: 'utf-8' });
    }
  }

  const uncovered = (await findEnvSources(workspaces, parser)).filter((path) => !covered.has(path));
  const problems: string[] = [];

  if (parser.violations.length) {
    problems.push(
      'Environment values arrive as strings, so these need `zod.coerce`:',
      ...parser.violations.map(
        (violation) =>
          `  - ${violation.source}: ${violation.name} uses \`zod.${violation.base}()\` — it parses only while the variable is unset`,
      ),
    );
  }

  // Always fatal, in both modes: the generator cannot fix this by writing, because it has no way
  // of knowing which section of the page a new config file belongs under.
  if (uncovered.length) {
    problems.push(
      'These files validate environment nothing documents — add an `env-table` marker for each:',
      ...uncovered.map((path) => `  - ${relative(REPOSITORY_ROOT, path)}`),
    );
  }

  if (check && changed.length) {
    problems.push(
      'Env tables are out of date with their zod schemas:',
      ...changed.map((doc) => `  - ${doc}`),
      `Run \`${GENERATE_COMMAND}\`.`,
    );
  }

  if (problems.length) {
    console.error(problems.join('\n'));
    throw new Error('env-docs check failed');
  }

  if (check) {
    console.log('Env tables match their zod schemas.');
    return;
  }

  console.log(
    changed.length
      ? `Updated ${changed.length} env table(s):\n${changed.map((doc) => `  - ${doc}`).join('\n')}`
      : 'Env tables already up to date.',
  );
};

compile()
  .then()
  .catch((error: unknown) => {
    if (error instanceof Error && error.message !== 'env-docs check failed') {
      console.error(error.message);
    }

    process.exit(1);
  });
