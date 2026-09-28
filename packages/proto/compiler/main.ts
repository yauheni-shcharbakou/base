import { Browser } from '@compiler/adapters/browser';
import { compileProto } from '@compiler/compile-proto';

/**
 * Emits this package's own `src/` — the browser-safe types. The Nest and Client flavors are
 * emitted by `@backend/proto` and `@frontend/proto`, each in its own turbo task against its own
 * `src/`, through the build-time API in `./index.ts`.
 */
const compile = async () => {
  try {
    await compileProto(Browser);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message, error.stack);
    } else {
      console.error('Browser proto compiler error');
    }

    throw error;
  }
};

compile()
  .then()
  .catch(() => process.exit(1));
