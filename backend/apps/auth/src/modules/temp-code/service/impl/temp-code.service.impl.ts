import { GrpcBaseQuery, GrpcIdField, GrpcTempCode, GrpcTempCodeCreate } from '@backend/grpc';
import { CrudServiceImpl, PERSISTENCE_SERVICE, PersistenceService } from '@backend/persistence';
import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Either } from '@sweet-monads/either';
import {
  TEMP_CODE_REPOSITORY,
  TempCodeRepository,
} from 'common/repositories/temp-code/temp-code.repository';
import { Config } from 'config';
import _ from 'lodash';
import { TempCodeService } from 'modules/temp-code/service/temp-code.service';
import moment from 'moment';
import { randomUUID } from 'node:crypto';

export class TempCodeServiceImpl
  extends CrudServiceImpl<
    GrpcTempCode,
    GrpcBaseQuery,
    GrpcTempCodeCreate,
    undefined,
    TempCodeRepository
  >
  implements TempCodeService
{
  private readonly logger = new Logger(TempCodeServiceImpl.name);

  constructor(
    private readonly configService: ConfigService<Config>,
    @Inject(TEMP_CODE_REPOSITORY) protected readonly repository: TempCodeRepository,
    @Inject(PERSISTENCE_SERVICE) private readonly persistenceService: PersistenceService,
  ) {
    super();
  }

  async saveOne(createData: GrpcTempCodeCreate): Promise<Either<Error, GrpcTempCode>> {
    const expiresInMinutes = this.configService.get('tempCode.expiresInMinutes', { infer: true });

    return this.repository.saveOne({
      ...createData,
      isActive: true,
      expiredAt: moment().add(expiresInMinutes, 'minutes').toDate(),
      code: randomUUID(),
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async disableExpiredCodes() {
    try {
      const expiresInMinutes = this.configService.get('tempCode.expiresInMinutes', { infer: true });

      await this.persistenceService.isolatedRun(async () => {
        let page = 1;
        let hasNext = true;
        const expiredBefore = moment().subtract(expiresInMinutes, 'minutes').toDate();

        do {
          const { items, total } = await this.repository.getList({
            query: {
              isActive: true,
              expiredBefore,
            },
            pagination: {
              page,
              limit: 100,
            },
          });

          if (items.length) {
            const ids = _.map(items, 'id');
            await this.repository.updateMany({ ids }, { set: { isActive: false } });
          }

          hasNext = page * 100 < total;
          page += 1;
        } while (hasNext);
      });
    } catch (error) {
      this.logger.error('disableExpiredCodes', error.message, error.stack);
    }
  }

  async onDeactivateOne(event: GrpcIdField): Promise<void> {
    await this.repository.updateOne({ id: event.id }, { set: { isActive: false } });
  }
}
