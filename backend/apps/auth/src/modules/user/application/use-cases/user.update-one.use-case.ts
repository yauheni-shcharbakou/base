import { NestAuth } from '@backend/proto';
import { CryptoService } from '@modules/crypto/domain/services/crypto.service';
import { UserRepository, UserUpdate } from '@modules/user/domain/repositories/user.repository';
import { Injectable } from '@nestjs/common';
import { Either } from '@sweet-monads/either';
import _ from 'lodash';

@Injectable()
export class UserUpdateOneUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly cryptoService: CryptoService,
  ) {}

  async execute(
    query: Partial<NestAuth.UserQuery>,
    updateData: NestAuth.UserUpdate,
  ): Promise<Either<Error, NestAuth.User>> {
    const update: UserUpdate = {
      ...updateData,
      set: _.omit(updateData.set ?? {}, 'password'),
    };

    if (updateData.set?.password) {
      const hashedPassword = await this.cryptoService.hash(updateData.set.password);

      if (hashedPassword.isRight()) {
        update.set.hash = hashedPassword.value;
      }
    }

    return this.userRepository.updateOne(query, update);
  }
}
