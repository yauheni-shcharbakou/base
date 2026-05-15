export const DATABASE_RUNNER_SERVICE = Symbol('DatabaseRunnerService');

export interface DatabaseRunnerService {
  isolatedRun<Res>(callback: () => Promise<Res>): Promise<Res>;
}
