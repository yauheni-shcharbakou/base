import {
  GrpcUser,
  GrpcUserCreate,
  GrpcUserQuery,
  GrpcUserRole,
  GrpcUserUpdate,
} from '@backend/grpc';
import { CrudServiceImpl } from '@backend/persistence';
import { InjectNatsClient, NatsClient } from '@backend/transport';
import { Inject, NotFoundException } from '@nestjs/common';
import { Either, left } from '@sweet-monads/either';
import {
  USER_REPOSITORY,
  UserRepository,
  UserUpdate,
} from 'common/repositories/user/user.repository';
import { CRYPTO_SERVICE, CryptoService } from 'common/services/crypto/crypto.service';
import _ from 'lodash';
import { UserService } from 'modules/user/service/user.service';
import { firstValueFrom } from 'rxjs';

export class UserServiceImpl
  extends CrudServiceImpl<GrpcUser, GrpcUserQuery, GrpcUserCreate, GrpcUserUpdate, UserRepository>
  implements UserService
{
  constructor(
    @Inject(USER_REPOSITORY) protected readonly repository: UserRepository,
    @Inject(CRYPTO_SERVICE) private readonly cryptoService: CryptoService,
    @InjectNatsClient() private readonly natsClient: NatsClient,
  ) {
    super();
  }

  async saveOne(data: GrpcUserCreate): Promise<Either<Error, GrpcUser>> {
    const hashedPassword = await this.cryptoService.hash(data.password);

    if (hashedPassword.isLeft()) {
      return left(hashedPassword.value);
    }

    const user = await this.repository.saveOne({
      ...data,
      hash: hashedPassword.value,
      role: data.role ?? GrpcUserRole.USER,
    });

    if (user.isRight()) {
      await firstValueFrom(this.natsClient.auth.user.createOne({ id: user.value.id }));
    }

    return user;
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
