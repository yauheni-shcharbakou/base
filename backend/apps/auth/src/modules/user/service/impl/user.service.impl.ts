import {
  GrpcUser,
  GrpcUserCreate,
  GrpcUserQuery,
  GrpcUserRole,
  GrpcUserUpdate,
} from '@backend/grpc';
import { CrudServiceImpl } from '@backend/persistence';
import { Inject, NotFoundException } from '@nestjs/common';
import { Either, left } from '@sweet-monads/either';
import { CRYPTO_SERVICE, CryptoService } from 'common/modules/crypto/crypto.service';
import {
  USER_REPOSITORY,
  UserRepository,
  UserUpdate,
} from 'common/repositories/user/user.repository';
import _ from 'lodash';
import { UserService } from 'modules/user/service/user.service';

export class UserServiceImpl
  extends CrudServiceImpl<GrpcUser, GrpcUserQuery, GrpcUserCreate, GrpcUserUpdate, UserRepository>
  implements UserService
{
  constructor(
    @Inject(USER_REPOSITORY) protected readonly repository: UserRepository,
    @Inject(CRYPTO_SERVICE) private readonly cryptoService: CryptoService,
  ) {
    super();
  }

  async saveOne(data: GrpcUserCreate): Promise<Either<Error, GrpcUser>> {
    const hashedPassword = await this.cryptoService.hash(data.password);

    if (hashedPassword.isLeft()) {
      return left(hashedPassword.value);
    }

    return this.repository.saveOne({
      ...data,
      hash: hashedPassword.value,
      role: data.role ?? GrpcUserRole.USER,
    });
  }

  async updateById(
    id: string,
    updateData: GrpcUserUpdate,
  ): Promise<Either<NotFoundException, GrpcUser>> {
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

    return this.repository.updateById(id, update);
  }
}
