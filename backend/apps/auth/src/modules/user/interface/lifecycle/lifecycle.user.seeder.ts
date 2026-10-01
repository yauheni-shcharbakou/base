import { Config } from '@/config';
import { DatabaseRunnerService } from '@backend/common';
import { UserEnsureAdminUseCase } from '@modules/user/application/use-cases/user.ensure-admin.use-case';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LifecycleUserSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(LifecycleUserSeeder.name);

  constructor(
    private readonly ensureAdminUseCase: UserEnsureAdminUseCase,
    private readonly databaseRunnerService: DatabaseRunnerService,
    private readonly configService: ConfigService<Config>,
  ) {}

  // Thrown, not logged: an auth without an admin is a deployment nobody can log into, so the
  // bootstrap fails and `main.ts` exits with the reason.
  async onApplicationBootstrap() {
    const admin = this.configService.getOrThrow('admin', { infer: true });

    const result = await this.databaseRunnerService.isolatedRun(() =>
      this.ensureAdminUseCase.execute(admin),
    );

    if (result.isLeft()) {
      throw result.value;
    }

    if (result.value) {
      this.logger.log(`Admin ${admin.email} created`);
    }
  }
}
