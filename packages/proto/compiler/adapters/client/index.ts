import { FRONTEND_PACKAGES_DIR_ROOT } from 'compiler/constants';
import { CommonTask, RemoveOptionalityTask } from 'compiler/tasks';
import { join } from 'node:path';
import { FixClientExportsTask } from './tasks/fix-client-exports.task';
import { AddClientRepositoriesTask } from './tasks/add-client-repositories.task';
import { ClientAdapter } from './client.adapter';

export const Client = ClientAdapter.createFactory({
  name: 'client',
  targetRoot: join(FRONTEND_PACKAGES_DIR_ROOT, 'proto', 'src'),
  templatePath: join(__dirname, 'templates'),
  transformTasks: [
    CommonTask,
    RemoveOptionalityTask,
    FixClientExportsTask,
    AddClientRepositoriesTask,
  ],
  restrictedContexts: ['backend'],
});
