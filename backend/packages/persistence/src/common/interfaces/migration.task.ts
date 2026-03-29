export interface MigrationTask {
  up(): Promise<void>;
}
