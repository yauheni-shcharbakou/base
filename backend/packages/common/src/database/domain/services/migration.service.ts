export const MIGRATION_SERVICE = Symbol('MigrationService');

export interface MigrationService {
  runTasks(): Promise<void>;
}
