export abstract class DatabaseRunnerService {
  abstract isolatedRun<Res>(callback: () => Promise<Res>): Promise<Res>;
}
