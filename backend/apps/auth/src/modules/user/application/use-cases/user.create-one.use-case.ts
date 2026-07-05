import { UserEventBus } from '@backend/event-bus';
import { NestAuth } from '@backend/proto';
import { CryptoService } from '@modules/crypto/domain/services/crypto.service';
import { UserRepository } from '@modules/user/domain/repositories/user.repository';
import { Injectable } from '@nestjs/common';
import { Either, left } from '@sweet-monads/either';

@Injectable()
export class UserCreateOneUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly cryptoService: CryptoService,
    private readonly eventBus: UserEventBus,
  ) {}

  async execute(createData: NestAuth.UserCreate): Promise<Either<Error, NestAuth.User>> {
    const hashedPassword = await this.cryptoService.hash(createData.password);

    if (hashedPassword.isLeft()) {
      return left(hashedPassword.value);
    }

    const user = await this.userRepository.saveOne({
      ...createData,
      hash: hashedPassword.value,
      role: createData.role ?? NestAuth.UserRole.USER,
    });

    if (user.isRight()) {
      await this.eventBus.emitCreate(user.value);
    }

    return user;
  }
}
