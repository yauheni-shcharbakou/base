import { DatabaseRunnerService } from '@backend/common';
import { RequestContext } from '@mikro-orm/core';
import { MikroORM } from '@mikro-orm/postgresql';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class PostgresDatabaseRunnerServiceImpl implements DatabaseRunnerService {
  constructor(@Inject(MikroORM) private readonly orm: MikroORM) {}

  isolatedRun<Res>(callback: () => Promise<Res>): Promise<Res> {
    return RequestContext.create(this.orm.em, () => callback());
  }
}
