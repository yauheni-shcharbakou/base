import { RequestContext } from '@mikro-orm/core';
import { MikroORM } from '@mikro-orm/postgresql';
import { Inject, Injectable } from '@nestjs/common';
import { PersistenceService } from 'common';

@Injectable()
export class PostgresPersistenceServiceImpl implements PersistenceService {
  constructor(@Inject(MikroORM) private readonly orm: MikroORM) {}

  isolatedRun<Res>(callback: () => Promise<Res>): Promise<Res> {
    return new Promise<Res>((resolve, reject) => {
      RequestContext.create(this.orm.em, async () => {
        try {
          const res = await callback();
          resolve(res);
        } catch (e) {
          reject(e);
        }
      });
    });
  }
}
