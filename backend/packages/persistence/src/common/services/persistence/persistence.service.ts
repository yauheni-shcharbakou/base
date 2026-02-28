export const PERSISTENCE_SERVICE = Symbol('PersistenceService');

export interface PersistenceService {
  isolatedRun<Res>(callback: () => Promise<Res>): Promise<Res>;
}
