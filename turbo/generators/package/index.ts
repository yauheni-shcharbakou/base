import { PlopTypes } from '@turbo/gen';
import { join } from 'path';

export const packageGenerator = (plop: PlopTypes.NodePlopAPI) => {
  const packageRootByType = new Map([
    ['default', join('{{ turbo.paths.root }}', 'packages', '{{ dashCase name }}')],
    ['admin', join('{{ turbo.paths.root }}', 'admin/packages', '{{ dashCase name }}')],
    ['backend', join('{{ turbo.paths.root }}', 'backend/packages', '{{ dashCase name }}')],
  ]);

  const types = Array.from(packageRootByType.keys());

  plop.setGenerator('package', {
    description: 'Generate new package',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'What is the name of the new package to create?',
        validate: (input: string) => {
          if (input.includes('/')) {
            return 'package name cannot include slashes';
          }
          if (input.includes(' ')) {
            return 'package name cannot include spaces';
          }
          if (!input) {
            return 'package name is required';
          }
          return true;
        },
      },
      {
        type: 'list',
        name: 'type',
        message: 'What is the type of the new package?',
        choices: types,
        default: types[0],
      },
    ],
    actions: (answers: { type: string }) => {
      const typeTemplatesRoot = join(__dirname, 'templates', answers.type);

      return [
        {
          type: 'addMany',
          destination: packageRootByType.get(answers.type),
          base: typeTemplatesRoot,
          templateFiles: [typeTemplatesRoot, join(typeTemplatesRoot, '.*')],
        },
      ];
    },
  });
};
