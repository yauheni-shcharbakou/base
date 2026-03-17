import { GrpcUserRole } from '@backend/grpc';
import { MigrationTask } from '@backend/persistence';
import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserEntity } from 'common/repositories/user/entities/user.entity';
import { CRYPTO_SERVICE, CryptoService } from 'common/services/crypto/crypto.service';
import { Config } from 'config';

@Injectable()
export class CreateAdminTask implements MigrationTask {
  constructor(
    private readonly configService: ConfigService<Config>,
    private readonly entityManager: EntityManager,
    @Inject(CRYPTO_SERVICE) private readonly cryptoService: CryptoService,
  ) {}

  async up() {
    const email = this.configService.getOrThrow('admin.email', { infer: true });
    const password = this.configService.getOrThrow('admin.password', { infer: true });
    const hash = await this.cryptoService.hash(password);

    if (hash.isLeft()) {
      throw hash.value;
    }

    const user = this.entityManager.create(UserEntity, {
      email,
      hash: hash.value,
      role: GrpcUserRole.ADMIN,
    });

    await this.entityManager.persist(user).flush();
  }
}
