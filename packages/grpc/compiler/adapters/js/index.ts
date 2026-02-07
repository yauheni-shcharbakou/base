import { JsAdapter } from 'compiler/adapters/js/js.adapter';
import { AddJsRepositoriesTask } from 'compiler/adapters/js/tasks/add-js-repositories.task';
import { FixJsExportsTask } from 'compiler/adapters/js/tasks/fix-js-exports.task';
import { FRONTEND_PACKAGES_DIR_ROOT } from 'compiler/constants';
import { CommonTask } from 'compiler/tasks';
import { join } from 'path';

export const Js = JsAdapter.createFactory({
  name: 'js',
  targetRoot: join(FRONTEND_PACKAGES_DIR_ROOT, 'grpc', 'src'),
  transformTasks: [CommonTask, FixJsExportsTask, AddJsRepositoriesTask],
  restrictedContexts: ['backend'],
});
