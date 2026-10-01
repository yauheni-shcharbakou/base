import { basename } from 'path';
import { SHARED_SCHEMA_PACKAGE } from './constants';
import { EnvSchemaModel, EnvServiceModel } from './models';

const HEADERS = ['Variable', 'Type', 'Default'] as const;
const SOURCE_HEADER = 'Source';
const SERVICE_HEADERS = ['Service', 'Packages'] as const;

/** `|` ends a cell in a pipe table, so any that survives rendering has to be escaped. */
const escape = (value: string): string => value.replace(/\|/g, '\\|');

const padRow = (cells: string[], widths: number[]): string =>
  `| ${cells.map((cell, index) => cell.padEnd(widths[index])).join(' | ')} |`;

const code = (value: string): string => `\`${value}\``;

const list = (values: string[]): string => values.map(code).join(', ');

/** The same names as a sentence rather than a cell: `a`, `a and b`, `a, b and c`. */
const enumerate = (values: string[]): string =>
  values.length > 1
    ? `${list(values.slice(0, -1))} and ${code(values[values.length - 1])}`
    : list(values);

/** Builds the pipe table both marker kinds render into, columns padded to a common width. */
const renderRows = (headers: string[], rows: string[][]): string => {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index].length)),
  );

  return [
    padRow(headers, widths),
    `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`,
    ...rows.map((row) => padRow(row, widths)),
  ].join('\n');
};

/**
 * Renders parsed schemas into the markdown a marked region is replaced with.
 *
 * Only the mechanical facts go in — name, type, whether it is required, what it defaults to.
 * Those are what drift when a schema changes. The reasoning around a value stays hand-written
 * prose outside the markers, where a generator has no business.
 */
export class EnvTableRenderer {
  renderVariables(schemas: EnvSchemaModel[]): string {
    const table = this.renderTable(schemas);
    const blocks = [table, this.renderReferences(schemas, Boolean(table))];

    return blocks.filter(Boolean).join('\n\n');
  }

  /**
   * The service map: which packages' environment an app inherits by wiring them.
   *
   * Derived from the manifests rather than written down, because it is the one answer this page
   * owes a deployment that no single schema can give — a service's env is the union of its own
   * configs and those of everything it pulls in.
   */
  renderServices(services: EnvServiceModel[], dormant: string[]): string {
    const rows = services.map((service) => [
      code(service.name),
      service.packages.length ? list(service.packages) : '—',
    ]);

    const blocks = [rows.length ? renderRows([...SERVICE_HEADERS], rows) : ''];

    if (dormant.length) {
      const verb = dormant.length > 1 ? 'declare' : 'declares';
      blocks.push(`${enumerate(dormant)} ${verb} environment no service wires.`);
    }

    return blocks.filter(Boolean).join('\n\n');
  }

  protected renderTable(schemas: EnvSchemaModel[]): string {
    const variables = schemas.flatMap((schema) => schema.variables);

    if (!variables.length) {
      return '';
    }

    // The source column only earns its width when the table merges more than one config file.
    const withSource = schemas.filter((schema) => schema.variables.length).length > 1;
    const headers = withSource ? [...HEADERS, SOURCE_HEADER] : [...HEADERS];

    const rows = variables.map((variable) => {
      const cells = [code(variable.name), escape(variable.type), escape(variable.defaultValue)];

      return withSource ? [...cells, code(basename(variable.source))] : cells;
    });

    return renderRows(headers, rows);
  }

  /**
   * A shared shape is documented where it is declared, not repeated in every package that
   * spreads it — `DATABASE_URL` would otherwise appear in four tables at once.
   */
  protected renderReferences(schemas: EnvSchemaModel[], hasTable: boolean): string {
    const references = [...new Set(schemas.flatMap((schema) => schema.references))];

    if (!references.length) {
      return '';
    }

    const noun = references.length > 1 ? 'shapes' : 'shape';
    const lead = hasTable ? 'Plus the shared' : 'Nothing of its own — the shared';

    return `${lead} ${noun} ${enumerate(references)} from ${code(SHARED_SCHEMA_PACKAGE)}, tabulated under *Shared shapes*.`;
  }
}
