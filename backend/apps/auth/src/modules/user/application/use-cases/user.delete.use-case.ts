import { CacheService } from '@backend/cache';
import { DeleteUseCase, isUnfilteredQuery } from '@backend/common';
import { UserEventBus } from '@backend/event-bus';
import { NestAuth } from '@backend/proto';
import { USER_CACHE } from '@modules/user/domain/constants/user.tokens';
import { UserRepository } from '@modules/user/domain/repositories/user.repository';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';
import _ from 'lodash';

/**
 * Every deletion emits `auth.user.delete` for the users it removed — storage drops their tree and
 * media on it, so a delete path that skips the event leaves them behind for good.
 */
@Injectable()
export class UserDeleteUseCase extends DeleteUseCase<NestAuth.User, NestAuth.UserQuery> {
  constructor(
    protected readonly repository: UserRepository,
    @Inject(USER_CACHE)
    private readonly userCache: CacheService,
    private readonly eventBus: UserEventBus,
  ) {
    super(repository);
  }

  /**
   * `deleteMany` reports a boolean, not the rows it removed, so the users are read first and deleted
   * by those ids: the event then names exactly the rows that went. With no ids to evict, the whole
   * `cache:auth:user:*` scope goes instead. A deleted user must never keep passing the gateway's
   * access guard.
   *
   * An unfiltered query is refused here, before the read: the repository's own guard only sees the
   * ids that read returned, so it would take every user.
   */
  async deleteMany(query: Partial<NestAuth.UserQuery>): Promise<boolean> {
    if (isUnfilteredQuery(query)) {
      throw new BadRequestException('User delete: a filter is required');
    }

    const users = await this.repository.getMany(query);

    if (!users.length) {
      return false;
    }

    const deleted = await super.deleteMany({ ids: _.map(users, 'id') });

    if (deleted) {
      await this.userCache.deleteByPrefix();
      await this.eventBus.emitManyDelete(users);
    }

    return deleted;
  }

  protected async afterSingleDeletion(
    result: Either<NotFoundException, NestAuth.User>,
  ): Promise<void> {
    if (result.isRight()) {
      await this.userCache.delete(result.value.id);
      await this.eventBus.emitDelete(result.value);
    }
  }
}
