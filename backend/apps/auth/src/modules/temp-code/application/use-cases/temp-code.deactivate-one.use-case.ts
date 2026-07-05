import { NestAuth } from '@backend/proto';
import {
  TempCodeQuery,
  TempCodeRepository,
} from '@modules/temp-code/domain/repositories/temp-code.repository';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';

@Injectable()
export class TempCodeDeactivateOneUseCase {
  constructor(private readonly tempCodeRepository: TempCodeRepository) {}

  async execute(
    query: Partial<TempCodeQuery>,
  ): Promise<Either<NotFoundException, NestAuth.TempCode>> {
    return this.tempCodeRepository.updateOne(query, { set: { isActive: false } });
  }
}
