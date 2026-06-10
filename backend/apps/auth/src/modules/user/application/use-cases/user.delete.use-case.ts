import { DeleteUseCase } from '@backend/common';
import { NestAuth } from '@backend/proto';
import { UserRepository } from '@modules/user/domain/repositories/user.repository';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UserDeleteUseCase extends DeleteUseCase<NestAuth.User, NestAuth.UserQuery> {
  constructor(protected readonly repository: UserRepository) {
    super(repository);
  }
}
