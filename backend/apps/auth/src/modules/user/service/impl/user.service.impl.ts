import { User, UserCreate, UserQuery, UserRole, UserUpdate } from '@backend/grpc';
import { Inject, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Either, left } from '@sweet-monads/either';
import { CRYPTO_SERVICE, CryptoService } from 'common/modules/crypto/crypto.service';
import {
  USER_REPOSITORY,
  UserRepository,
  UserUpdateInternal,
} from 'common/repositories/user/user.repository';
import _ from 'lodash';
import { UserService } from 'modules/user/service/user.service';

export class UserServiceImpl implements UserService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(CRYPTO_SERVICE) private readonly cryptoService: CryptoService,
  ) {}

  async create(data: UserCreate): Promise<Either<InternalServerErrorException, User>> {
    const hashedPassword = await this.cryptoService.hash(data.password);

    if (hashedPassword.isLeft()) {
      return left(hashedPassword.value);
    }

    return this.userRepository.saveOne({
      ...data,
      hash: hashedPassword.value,
      role: data.role ?? UserRole.USER,
    });
  }

  async updateOne(
    query: UserQuery,
    updateData: UserUpdate,
  ): Promise<Either<NotFoundException, User>> {
    const update: UserUpdateInternal = {
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
