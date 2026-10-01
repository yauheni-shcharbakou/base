import { CacheService } from '@backend/cache';
import { NestAuth } from '@backend/proto';
import { AuthTokenService } from '@modules/auth/domain/services/auth.token.service';
import { USER_CACHE } from '@modules/user/domain/constants/user.tokens';
import { UserRepository } from '@modules/user/domain/repositories/user.repository';
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';

@Injectable()
export class AuthGetUserByTokenUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenService: AuthTokenService,
    @Inject(USER_CACHE)
    private readonly userCache: CacheService,
  ) {}

  /**
   * The gateway's unary access guard calls this on every request, so the read is cached by user
   * id. Cache writes are invalidated by `UserUpdateOneUseCase` / `UserDeleteUseCase` — the same
   * service owns them, so a role change or a deletion still takes effect immediately.
   *
   * `get`/`set` rather than `cacheService.wrap`: the factory here returns an `Either`, which does
   * not survive a JSON round-trip, and flattening it to `User | null` would both lose the
   * repository's own `NotFoundException` and write a `null` per request for a deleted user (the
   * cache does no negative caching). The cost is no single-flight dedupe on a cold key.
   */
  async execute(data: NestAuth.AuthMe): Promise<Either<Error, NestAuth.User>> {
    const payload = this.tokenService.parseAccessTokenPayload(data.accessToken);

    if (payload.isLeft()) {
      return left(new ForbiddenException('Access token invalid'));
    }

    const cached = await this.userCache.get<NestAuth.User>(payload.value.id);

    if (cached) {
      return right(this.reviveTimestamps(cached));
    }

    const user = await this.userRepository.getById(payload.value.id);

    if (user.isRight()) {
      await this.userCache.set(payload.value.id, user.value);
    }

    return user;
  }

  /**
   * A value crosses the cache as JSON, so `createdAt` comes back an ISO **string** even though
   * the proto type says `Date` — the same property the event bus has. The gRPC timestamp wrapper
   * calls `getTime()` on it, which a string does not have, so the dates are rebuilt on the way
   * out of the cache rather than left to fail at serialization.
   */
  private reviveTimestamps(user: NestAuth.User): NestAuth.User {
    return {
      ...user,
      createdAt: new Date(user.createdAt),
      updatedAt: user.updatedAt ? new Date(user.updatedAt) : undefined,
    };
  }
}
