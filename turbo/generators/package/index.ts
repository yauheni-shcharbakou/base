import { PlopTypes } from '@turbo/gen';
import { join } from 'path';

export const packageGenerator = (plop: PlopTypes.NodePlopAPI) => {
  const packageRootByType = new Map([
    ['default', join('{{ turbo.paths.root }}', 'packages', '{{ dashCase name }}')],
    ['backend', join('{{ turbo.paths.root }}', 'backend/packages', '{{ dashCase name }}')],
    ['frontend', join('{{ turbo.paths.root }}', 'frontend/packages', '{{ dashCase name }}')],
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
    actions: (answers?: PlopTypes.Answers) => {
      const chosenType: string = answers?.['type'] || 'default';
      // Relative, so plop resolves it against the plopfile (`turbo/generators`). Not `__dirname`:
      // turbo bundles the generators into one file, which makes it `turbo/generators` too, and a
      // path that matches nothing still ends in "Success!" with 0 files added.
      const typeTemplatesRoot = `package/templates/${chosenType}`;

      return [
        {
          type: 'addMany',
          destination: packageRootByType.get(chosenType)!,
          base: typeTemplatesRoot,
          templateFiles: `${typeTemplatesRoot}/**/*`,
          globOptions: { dot: true },
        },
      ];
    },
  });
};
