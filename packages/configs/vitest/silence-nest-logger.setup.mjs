import { Logger } from '@nestjs/common';

// An e2e suite asserts on responses, never on logs: a failed query a spec causes on purpose, a
// cron's "Marked N expired upload(s)" — each would only bury the reporter's output. `E2E_LOGS=1`
// keeps them for a debugging run.
if (!process.env.E2E_LOGS) {
  Logger.overrideLogger(false);
  // Pinned, not just set: `TestingModuleBuilder.compile()` overrides the logger again with its
  // `TestingLogger`, which still prints every error.
  Logger.overrideLogger = () => {};
}
