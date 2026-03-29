import { BrowserAdapter } from 'compiler/adapters/browser/browser.adapter';
import { FixBrowserEmptyFilesTask } from 'compiler/adapters/browser/tasks/fix-browser-empty-files.task';
import { GRPC_PACKAGE_ROOT } from 'compiler/constants';
import { CommonTask, RemoveOptionalityTask } from 'compiler/tasks';
import { join } from 'node:path';

export const Browser = BrowserAdapter.createFactory({
  name: 'browser',
  targetRoot: join(GRPC_PACKAGE_ROOT, 'src'),
  transformTasks: [CommonTask, RemoveOptionalityTask, FixBrowserEmptyFilesTask],
});
