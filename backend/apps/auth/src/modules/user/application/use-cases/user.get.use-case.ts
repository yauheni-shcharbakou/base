import { GetUseCase } from '@backend/common';
import { NestAuth } from '@backend/proto';
import { UserRepository } from '@modules/user/domain/repositories/user.repository';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UserGetUseCase extends GetUseCase<NestAuth.User, NestAuth.UserQuery> {
  constructor(protected readonly repository: UserRepository) {
    super(repository);
  }
}
