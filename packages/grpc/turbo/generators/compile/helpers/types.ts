import { Context } from '../context';

export type GrpcCompilerAnswers = {
  files: Set<string>;
  indexExports: Set<string>;
  context: Context;
};

export type Type<T> = {
  new (...args: any[]): T;
};
