export interface MigrationService {
  runTasks(): Promise<void>;
}
