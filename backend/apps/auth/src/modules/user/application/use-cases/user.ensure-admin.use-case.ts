import { NestAuth } from '@backend/proto';
import { UserRepository } from '@modules/user/domain/repositories/user.repository';
import { ConflictException, Injectable } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import { UserCreateOneUseCase } from './user.create-one.use-case';

export interface UserEnsureAdmin {
  email: string;
  password: string;
}

/**
 * Gives a fresh deployment its first login. Runs on every start and creates the admin only while
 * there is none, through the regular create: `auth.user.create` goes out as for any other user, so
 * storage opens the admin's root folder itself. An existing admin is never touched — not even its
 * password, whatever the configuration says now.
 */
@Injectable()
export class UserEnsureAdminUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly createOneUseCase: UserCreateOneUseCase,
  ) {}

  /** `true` when this call created the admin, `false` when one was already there. */
  async execute({ email, password }: UserEnsureAdmin): Promise<Either<Error, boolean>> {
    if (await this.hasAdmin()) {
      return right(false);
    }

    const created = await this.createOneUseCase.execute({
      email,
      password,
      role: NestAuth.UserRole.ADMIN,
    });

    if (created.isRight()) {
      return right(true);
    }

    if (!(created.value instanceof ConflictException)) {
      return left(created.value);
    }

    // A replica starting at the same moment took the email first, and its admin counts. With no
    // admin behind the conflict, the email belongs to a regular user instead.
    if (await this.hasAdmin()) {
      return right(false);
    }

    return left(
      new ConflictException(`The admin email ${email} belongs to a user who is not an admin`),
    );
  }

  private hasAdmin(): Promise<boolean> {
    return this.userRepository.isExists({ roles: [NestAuth.UserRole.ADMIN] });
  }
}
