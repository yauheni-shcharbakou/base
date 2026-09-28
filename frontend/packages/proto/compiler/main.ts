import { ClientAdapter } from '@compiler/client.adapter';
import { AddClientRepositoriesTask } from '@compiler/tasks/add-client-repositories.task';
import { FixClientExportsTask } from '@compiler/tasks/fix-client-exports.task';
import { CommonTask, compileProto, RemoveOptionalityTask } from '@packages/proto/compiler';
import { join } from 'node:path';

/**
 * Emits this package's `src/` — the grpc-js client flavor of `@packages/proto/pkg`: message
 * namespaces and the `Grpc<X>Repository` classes. Runs as this package's own turbo `compile`
 * task, so the output it writes is the output that task declares.
 */
const compile = async () => {
  try {
    await compileProto(
      ClientAdapter.createFactory({
        name: 'client',
        targetRoot: join(__dirname, '..', 'src'),
        templatePath: join(__dirname, 'templates'),
        transformTasks: [
          CommonTask,
          RemoveOptionalityTask,
          FixClientExportsTask,
          AddClientRepositoriesTask,
        ],
      }),
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message, error.stack);
    } else {
      console.error('Client proto compiler error');
    }

    throw error;
  }
};

compile()
  .then()
  .catch(() => process.exit(1));
