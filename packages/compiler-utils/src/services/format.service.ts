import { writeFile } from 'fs/promises';
import { format, Options, resolveConfig } from 'prettier';
import type { SourceFile } from 'ts-morph';

/**
 * Formats generated code at write time.
 *
 * Formatting used to live in each package's `build` script, which left two holes:
 * turbo caches the `compile` outputs before that script runs and restores the raw
 * output on a cache hit, and a compiler writing into a sibling package is not
 * followed by that package's build unless it happens to be in the task graph.
 * Formatting here keeps the file on disk and the file in the cache identical.
 */
export class FormatService {
  protected async getOptions(filePath: string): Promise<Options> {
    // Resolves the repository-root .prettierrc; prettier caches the lookup itself.
    return (await resolveConfig(filePath)) ?? {};
  }

  async formatText(content: string, filePath: string): Promise<string> {
    const options = await this.getOptions(filePath);
    return format(content, { ...options, filepath: filePath });
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const formatted = await this.formatText(content, filePath);
    await writeFile(filePath, formatted, { encoding: 'utf-8' });
  }

  /**
   * ts-morph counterpart of `writeFile`: the formatted text is written back into the
   * project first, so the in-memory source file and the file on disk stay in sync.
   */
  async saveSourceFile(sourceFile: Omit<SourceFile, '#private'>): Promise<void> {
    const filePath = sourceFile.getFilePath();
    const formatted = await this.formatText(sourceFile.getFullText(), filePath);

    sourceFile.replaceWithText(formatted);
    await sourceFile.save();
  }
}
