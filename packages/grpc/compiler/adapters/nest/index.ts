import { NestAdapter } from 'compiler/adapters/nest/nest.adapter';
import { AddNestServiceSchemasTask } from 'compiler/adapters/nest/tasks/add-nest-service-schemas.task';
import { FixNestExportsTask } from 'compiler/adapters/nest/tasks/fix-nest-exports.task';
import { BACKEND_PACKAGES_DIR_ROOT } from 'compiler/constants';
import { CommonTask, RemoveOptionalityTask } from 'compiler/tasks';
import { join } from 'node:path';

export const Nest = NestAdapter.createFactory({
  name: 'nest',
  targetRoot: join(BACKEND_PACKAGES_DIR_ROOT, 'grpc', 'src'),
  templatePath: join(__dirname, 'templates'),
  transformTasks: [
    CommonTask,
    RemoveOptionalityTask,
    FixNestExportsTask,
    AddNestServiceSchemasTask,
  ],
  restrictedContexts: ['frontend'],
});
