import { relative } from 'path';
import { Node, Project, PropertyAssignment, SyntaxKind } from 'ts-morph';
import { REPOSITORY_ROOT, VALIDATE_ENV_CALLEE } from './constants';
import { CoercionViolation, EnvSchemaModel, EnvVariableModel } from './models';

/** Calls that open a chain, mapped to the type word they render as. */
const BASE_TYPES: Record<string, string> = {
  string: 'string',
  number: 'number',
  boolean: 'boolean',
  email: 'email',
  url: 'url',
  uuid: 'uuid',
};

/** Bases whose value arrives as a string and therefore needs `zod.coerce`. */
const COERCION_REQUIRED = new Set(['number', 'boolean', 'bigint', 'date']);

/** Chain links that narrow a base rather than describing it. */
const STRING_FORMATS = new Set(['email', 'url', 'uuid']);

const BOUNDS: Record<string, string> = {
  positive: '> 0',
  nonnegative: '≥ 0',
  negative: '< 0',
  nonpositive: '≤ 0',
};

const ARGUMENT_BOUNDS: Record<string, string> = {
  min: '≥',
  gte: '≥',
  gt: '>',
  max: '≤',
  lte: '≤',
  lt: '<',
};

type ChainLink = {
  name: string;
  args: Node[];
};

type Chain = {
  coerce: boolean;
  /** Base call first, e.g. `number`, `int`, `positive`, `default`. */
  links: ChainLink[];
};

class ParseError extends Error {
  constructor(source: string, name: string, detail: string) {
    super(`${source}: ${name} — ${detail}`);
  }
}

/**
 * Reads `validateEnv` arguments out of a config file without running it.
 *
 * Running is not an option: `validateEnv` throws on a missing required variable and never hands
 * the schema back, so an importing generator would die exactly where a service without env dies.
 * Nothing here needs the type checker — only the shape of the call — so the files are parsed
 * syntactically and no tsconfig is loaded.
 */
export class EnvSchemaParser {
  protected readonly project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  });

  readonly violations: CoercionViolation[] = [];

  /**
   * Whether the file calls `validateEnv` — the AST question behind the coverage invariant.
   *
   * A text match cannot answer it: the helper's own declaration, a comment and this compiler's
   * error messages all contain the name. Files land in the same `Project`, so one parsed here and
   * tabulated later is read from disk once.
   */
  callsValidateEnv(filePath: string): boolean {
    const sourceFile =
      this.project.getSourceFile(filePath) ?? this.project.addSourceFileAtPath(filePath);

    return sourceFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .some((call) => call.getExpression().getText() === VALIDATE_ENV_CALLEE);
  }

  /**
   * @param filePath absolute path of the config file
   * @param exportName when given, the named exported shape instead of the `validateEnv` calls
   */
  parse(filePath: string, exportName?: string): EnvSchemaModel {
    const source = relative(REPOSITORY_ROOT, filePath);
    const sourceFile =
      this.project.getSourceFile(filePath) ?? this.project.addSourceFileAtPath(filePath);

    const schema: EnvSchemaModel = { source, variables: [], references: [] };
    const shapes: Node[] = [];

    if (exportName) {
      const declaration = sourceFile.getVariableDeclaration(exportName);

      if (!declaration) {
        throw new Error(`${source}: no exported \`${exportName}\``);
      }

      const initializer = declaration.getInitializer();

      if (!initializer) {
        throw new Error(`${source}: \`${exportName}\` has no initializer`);
      }

      shapes.push(initializer);
    } else {
      for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
        if (call.getExpression().getText() !== VALIDATE_ENV_CALLEE) {
          continue;
        }

        const [argument] = call.getArguments();

        if (!argument) {
          throw new Error(`${source}: \`${VALIDATE_ENV_CALLEE}()\` called without a schema`);
        }

        shapes.push(argument);
      }

      if (!shapes.length) {
        throw new Error(`${source}: no \`${VALIDATE_ENV_CALLEE}()\` call found`);
      }
    }

    for (const shape of shapes) {
      this.readShape(shape, schema);
    }

    return schema;
  }

  protected readShape(node: Node, schema: EnvSchemaModel): void {
    const shape = this.unwrap(node);

    // `validateEnv(NodeValidationSchema)` — the whole schema belongs to another file.
    if (Node.isIdentifier(shape)) {
      this.addReference(schema, shape.getText());
      return;
    }

    if (!Node.isObjectLiteralExpression(shape)) {
      throw new Error(`${schema.source}: expected an object literal, got \`${shape.getText()}\``);
    }

    for (const property of shape.getProperties()) {
      if (Node.isSpreadAssignment(property)) {
        const expression = property.getExpression();

        if (!Node.isIdentifier(expression)) {
          throw new Error(`${schema.source}: cannot resolve spread \`${property.getText()}\``);
        }

        this.addReference(schema, expression.getText());
        continue;
      }

      if (!Node.isPropertyAssignment(property)) {
        throw new Error(`${schema.source}: unsupported entry \`${property.getText()}\``);
      }

      schema.variables.push(this.readVariable(property.getNameNode(), property, schema.source));
    }
  }

  protected readVariable(
    nameNode: Node,
    property: PropertyAssignment,
    source: string,
  ): EnvVariableModel {
    const name = Node.isStringLiteral(nameNode) ? nameNode.getLiteralText() : nameNode.getText();
    const chain = this.readChain(property.getInitializerOrThrow(), source, name);
    const [base, ...modifiers] = chain.links;

    if (!BASE_TYPES[base.name] && base.name !== 'enum' && base.name !== 'literal') {
      throw new ParseError(source, name, `unsupported zod base \`${base.name}()\``);
    }

    if (COERCION_REQUIRED.has(base.name) && !chain.coerce) {
      this.violations.push({ source, name, base: base.name });
    }

    return {
      name,
      type: this.renderType(base, modifiers, source, name),
      defaultValue: this.renderDefault(modifiers, source, name),
      source,
    };
  }

  /**
   * Unrolls `zod.coerce.number().int().positive().default(1)` into `[number, int, positive,
   * default]` plus the `coerce` flag. The chain is walked from the outermost call inward, so the
   * collected links are reversed before being returned.
   */
  protected readChain(node: Node, source: string, name: string): Chain {
    const links: ChainLink[] = [];
    let current = node;

    while (Node.isCallExpression(current)) {
      const callee = current.getExpression();

      if (!Node.isPropertyAccessExpression(callee)) {
        throw new ParseError(source, name, `unsupported call \`${current.getText()}\``);
      }

      links.unshift({ name: callee.getName(), args: current.getArguments() });
      current = callee.getExpression();
    }

    const root = current.getText();

    if (root !== 'zod' && root !== 'z' && root !== 'zod.coerce' && root !== 'z.coerce') {
      throw new ParseError(source, name, `expected a zod chain, got \`${node.getText()}\``);
    }

    if (!links.length) {
      throw new ParseError(source, name, 'empty zod chain');
    }

    return { coerce: root.endsWith('.coerce'), links };
  }

  protected renderType(
    base: ChainLink,
    modifiers: ChainLink[],
    source: string,
    name: string,
  ): string {
    let type = this.renderBaseType(base, source, name);
    const bounds: string[] = [];
    let note = '';

    for (const link of modifiers) {
      if (link.name === 'optional' || link.name === 'default') {
        continue;
      }

      if (link.name === 'int') {
        type = 'integer';
        continue;
      }

      if (STRING_FORMATS.has(link.name)) {
        type = link.name;
        continue;
      }

      if (BOUNDS[link.name]) {
        bounds.push(BOUNDS[link.name]);
        continue;
      }

      if (ARGUMENT_BOUNDS[link.name]) {
        bounds.push(`${ARGUMENT_BOUNDS[link.name]} ${link.args[0]?.getText() ?? '?'}`);
        continue;
      }

      if (link.name === 'refine') {
        note = this.readRefineMessage(link);
        continue;
      }

      throw new ParseError(source, name, `unsupported zod modifier \`.${link.name}()\``);
    }

    return [type, bounds.join(', '), note && `(${note})`].filter(Boolean).join(' ');
  }

  protected renderBaseType(base: ChainLink, source: string, name: string): string {
    if (base.name === 'enum') {
      const [members] = base.args;

      if (!members || !Node.isArrayLiteralExpression(members)) {
        throw new ParseError(source, name, 'expected an inline array of enum members');
      }

      return members
        .getElements()
        .map((element) =>
          Node.isStringLiteral(element) ? `\`${element.getLiteralText()}\`` : element.getText(),
        )
        .join(' | ');
    }

    if (base.name === 'literal') {
      return `\`${this.readLiteral(base.args[0], source, name)}\``;
    }

    return BASE_TYPES[base.name];
  }

  protected renderDefault(modifiers: ChainLink[], source: string, name: string): string {
    const fallback = modifiers.find((link) => link.name === 'default');

    if (fallback) {
      return `\`${this.readLiteral(fallback.args[0], source, name)}\``;
    }

    return modifiers.some((link) => link.name === 'optional') ? '—' : '**required**';
  }

  protected readRefineMessage(link: ChainLink): string {
    const options = link.args[1];

    if (!options || !Node.isObjectLiteralExpression(options)) {
      return 'refined';
    }

    const message = options.getProperty('message');

    if (message && Node.isPropertyAssignment(message)) {
      const value = message.getInitializerOrThrow();

      if (Node.isStringLiteral(value)) {
        return value.getLiteralText();
      }
    }

    return 'refined';
  }

  protected readLiteral(node: Node | undefined, source: string, name: string): string {
    if (!node) {
      throw new ParseError(source, name, 'expected a literal value');
    }

    return Node.isStringLiteral(node) ? node.getLiteralText() : node.getText();
  }

  protected unwrap(node: Node): Node {
    return Node.isAsExpression(node) || Node.isParenthesizedExpression(node)
      ? this.unwrap(node.getExpression())
      : node;
  }

  protected addReference(schema: EnvSchemaModel, name: string): void {
    if (!schema.references.includes(name)) {
      schema.references.push(name);
    }
  }
}
