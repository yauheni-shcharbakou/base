import { NodeEnvironment } from '@packages/common';

declare global {
  namespace NodeJS {
    interface ProcessEnv extends NodeEnvironment {}
  }
}

export {};
