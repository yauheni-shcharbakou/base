import { CacheService } from '@backend/cache';
import { NestAuth } from '@backend/proto';
import { AuthSessionRepository } from '@modules/auth/domain/repositories/auth.session.repository';
import { CryptoService } from '@modules/crypto/domain/services/crypto.service';
import { USER_CACHE } from '@modules/user/domain/constants/user.tokens';
import { UserRepository, UserUpdate } from '@modules/user/domain/repositories/user.repository';
import { Inject, Injectable } from '@nestjs/common';
import { Either, left } from '@sweet-monads/either';
import _ from 'lodash';

@Injectable()
export class UserUpdateOneUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly cryptoService: CryptoService,
    @Inject(USER_CACHE)
    private readonly userCache: CacheService,
    private readonly sessionRepository: AuthSessionRepository,
  ) {}

  /**
   * A new password ends every session of the user: whoever signed in with the old one — the reason
   * a password is usually changed — would otherwise keep refreshing. The password goes first, so no
   * sign-in with the old one can open a session after the sweep. The user changing their own
   * password is signed out with the rest; an access token already issued lives to its `exp`.
   */
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

      // Never written without it: the update would report a password change that did not happen.
      if (hashedPassword.isLeft()) {
        return left(hashedPassword.value);
      }

      update.set.hash = hashedPassword.value;
    }

    const user = await this.userRepository.updateOne(query, update);

    if (user.isLeft()) {
      return user;
    }

    // Keyed off the updated entity, not the query: a user may be addressed by email here,
    // while the cache is keyed by id.
    await this.userCache.delete(user.value.id);

    if (update.set.hash) {
      await this.sessionRepository.deleteByUser(user.value.id);
    }

    return user;
  }
}
