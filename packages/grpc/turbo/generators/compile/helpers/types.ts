export type GrpcCompilerAnswers = {
  files: Set<string>;
  indexExports: Set<string>;
};

export type Type<T> = {
  new (...args: any[]): T;
};
