import { EVENT_BUS_IMPORT_SPECIFIER, STRATEGY_FILE_PATH, STRATEGY_ROOT } from '@compiler/constants';
import { Project } from 'ts-morph';
import { StrategyContext } from './context';
import { ServiceModel, StrategyParser } from './parser';

export * from './context';
export * from './parser';

export type StrategyModel = {
  project: Project;
  context: StrategyContext;
  services: ServiceModel[];
};

/**
 * Parses `EventBusStrategy` into the model every emitter works from.
 *
 * Each target package compiles in its own turbo task, so this runs once per process — the
 * ports package for the abstract buses, then each adapter package for its transports. The
 * model is not handed between them: it lives in memory and is rebuilt from the same strategy
 * file, which keeps `pnpm compile` inside any one package self-contained.
 */
export const parseStrategy = (): StrategyModel => {
  const project = new Project({
    compilerOptions: {
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
    },
  });

  const context = new StrategyContext(
    project,
    STRATEGY_ROOT,
    STRATEGY_FILE_PATH,
    EVENT_BUS_IMPORT_SPECIFIER,
  );

  return {
    project,
    context,
    services: new StrategyParser(context).getServices(),
  };
};
