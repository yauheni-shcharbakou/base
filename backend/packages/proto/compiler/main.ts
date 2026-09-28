import { NestAdapter } from '@compiler/nest.adapter';
import { AddNestServiceSchemasTask } from '@compiler/tasks/add-nest-service-schemas.task';
import { FixNestExportsTask } from '@compiler/tasks/fix-nest-exports.task';
import { CommonTask, compileProto, RemoveOptionalityTask } from '@packages/proto/compiler';
import { join } from 'node:path';

/**
 * Emits this package's `src/` — the Nest flavor of `@packages/proto/pkg`: message namespaces,
 * `Grpc<X>Transport` schemas and controller/client interfaces. Runs as this package's own turbo
 * `compile` task, so the output it writes is the output that task declares.
 */
const compile = async () => {
  try {
    await compileProto(
      NestAdapter.createFactory({
        name: 'nest',
        targetRoot: join(__dirname, '..', 'src'),
        templatePath: join(__dirname, 'templates'),
        transformTasks: [
          CommonTask,
          RemoveOptionalityTask,
          FixNestExportsTask,
          AddNestServiceSchemasTask,
        ],
      }),
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message, error.stack);
    } else {
      console.error('Nest proto compiler error');
    }

    throw error;
  }
};

compile()
  .then()
  .catch(() => process.exit(1));
