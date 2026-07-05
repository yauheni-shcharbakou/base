import { PUG_EXT_REG_EXP } from '@/constants';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import * as Pug from 'pug';

type TemplateOptions = {
  data: Record<string, any>;
  [field: string]: any;
};

export class TemplateService {
  protected readonly templateByName = new Map<string, Pug.compileTemplate>();

  constructor(protected readonly templatePath?: string) {}

  async parse() {
    if (!this.templatePath) {
      throw new Error('Template path is not provided');
    }

    const templateFiles = await readdir(this.templatePath, { recursive: true });

    await Promise.all(
      templateFiles.map(async (templateFile) => {
        if (!templateFile.endsWith('.pug')) {
          return;
        }

        const pathToTemplate = join(this.templatePath!, templateFile);
        const templateContent = await readFile(pathToTemplate, { encoding: 'utf-8' });

        this.templateByName.set(
          templateFile.replace(PUG_EXT_REG_EXP, ''),
          Pug.compile(templateContent, { pretty: false }),
        );
      }),
    );
  }

  render(templateName: string, data: TemplateOptions) {
    const template = this.templateByName.get(templateName);

    if (!template) {
      throw new Error('Template not found');
    }

    return template(data);
  }
}
