import { DatabaseRunnerService } from '@/database/domain';

export class EmptyDatabaseRunnerServiceImpl implements DatabaseRunnerService {
  isolatedRun<Res>(callback: () => Promise<Res>): Promise<Res> {
    return callback();
  }
}
