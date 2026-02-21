import { BrowserAdapter } from 'compiler/adapters/browser/browser.adapter';
import { GRPC_PACKAGE_ROOT } from 'compiler/constants';
import { CommonTask, RemoveOptionalityTask } from 'compiler/tasks';
import { join } from 'node:path';

export const Browser = BrowserAdapter.createFactory({
  name: 'browser',
  targetRoot: join(GRPC_PACKAGE_ROOT, 'src'),
  transformTasks: [CommonTask, RemoveOptionalityTask],
});
