export abstract class MigrationService {
  abstract runTasks(): Promise<void>;
}
