import { BrowserAdapter } from 'compiler/adapters/browser/browser.adapter';
import { GRPC_PACKAGE_ROOT } from 'compiler/constants';
import { CommonTask } from 'compiler/tasks';
import { join } from 'path';

export const Browser = BrowserAdapter.createFactory({
  name: 'browser',
  targetRoot: join(GRPC_PACKAGE_ROOT, 'src'),
  transformTasks: [CommonTask],
});
