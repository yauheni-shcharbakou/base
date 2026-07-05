import { Config } from '@/config';
import { TempCodeRepository } from '@modules/temp-code/domain/repositories/temp-code.repository';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import _ from 'lodash';
import moment from 'moment';

@Injectable()
export class TempCodeDeactivateExpiredUseCase {
  constructor(
    private readonly tempCodeRepository: TempCodeRepository,
    private readonly configService: ConfigService<Config>,
  ) {}

  async execute() {
    const expiresInMinutes = this.configService.get('tempCode.expiresInMinutes', { infer: true });

    let page = 1;
    let hasNext = true;
    const expiredBefore = moment().subtract(expiresInMinutes, 'minutes').toDate();

    do {
      const { items, total } = await this.tempCodeRepository.getList({
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
        await this.tempCodeRepository.updateMany({ ids }, { set: { isActive: false } });
      }

      hasNext = page * 100 < total;
      page += 1;
    } while (hasNext);
  }
}
