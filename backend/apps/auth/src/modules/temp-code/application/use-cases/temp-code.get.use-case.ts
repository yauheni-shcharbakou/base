import { GetUseCase } from '@backend/common';
import { NestAuth } from '@backend/proto';
import {
  TempCodeQuery,
  TempCodeRepository,
} from '@modules/temp-code/domain/repositories/temp-code.repository';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TempCodeGetUseCase extends GetUseCase<NestAuth.TempCode, TempCodeQuery> {
  constructor(protected readonly repository: TempCodeRepository) {
    super(repository);
  }
}
