import { PersistenceService } from 'common/services/persistence/persistence.service';

export class PersistenceServiceImpl implements PersistenceService {
  isolatedRun<Res>(callback: () => Promise<Res>): Promise<Res> {
    return callback();
  }
}
