import { DatabaseRunnerService } from '@backend/common';
import { UserPurgeDeletedUseCase } from '@modules/user/application/use-cases/user.purge-deleted.use-case';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CronUserScheduler {
  private readonly logger = new Logger(CronUserScheduler.name);

  constructor(
    private readonly purgeDeletedUseCase: UserPurgeDeletedUseCase,
    private readonly databaseRunnerService: DatabaseRunnerService,
  ) {}

  @Cron(CronExpression.EVERY_WEEK)
  async purgeDeletedUsers() {
    try {
      await this.databaseRunnerService.isolatedRun(async () => {
        const result = await this.purgeDeletedUseCase.execute();

        if (result.isLeft()) {
          throw result.value;
        }

        this.logger.log(`Deleted-user sweep done, ${result.value} user(s) purged`);
      });
    } catch (error) {
      this.logger.error('Deleted-user sweep error:', error.message, error.stack);
    }
  }
}
