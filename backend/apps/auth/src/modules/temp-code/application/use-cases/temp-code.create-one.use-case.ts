import { Config } from '@/config';
import { NestAuth } from '@backend/proto';
import { TempCodeRepository } from '@modules/temp-code/domain/repositories/temp-code.repository';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Either } from '@sweet-monads/either';
import { randomUUID } from 'crypto';
import moment from 'moment';

@Injectable()
export class TempCodeCreateOneUseCase {
  constructor(
    private readonly tempCodeRepository: TempCodeRepository,
    private readonly configService: ConfigService<Config>,
  ) {}

  async execute(createData: NestAuth.TempCodeCreate): Promise<Either<Error, NestAuth.TempCode>> {
    const expiresInMinutes = this.configService.get('tempCode.expiresInMinutes', { infer: true });

    return this.tempCodeRepository.saveOne({
      ...createData,
      isActive: true,
      expiredAt: moment().add(expiresInMinutes, 'minutes').toDate(),
      code: randomUUID(),
    });
  }
}
