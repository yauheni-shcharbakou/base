import { MigrationTask } from '@backend/common';
import { NestAuth } from '@backend/proto';
import { EntityManager } from '@mikro-orm/postgresql';
import { CryptoService } from '@modules/crypto/domain/services/crypto.service';
import { PgUserEntity } from '@modules/user/infrastructure/pg/entities/pg.user.entity';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '../../config';

@Injectable()
export class CreateAdminTask implements MigrationTask {
  constructor(
    private readonly configService: ConfigService<Config>,
    private readonly entityManager: EntityManager,
    private readonly cryptoService: CryptoService,
  ) {}

  async up() {
    const email = this.configService.getOrThrow('admin.email', { infer: true });
    const password = this.configService.getOrThrow('admin.password', { infer: true });
    const hash = await this.cryptoService.hash(password);

    if (hash.isLeft()) {
      throw hash.value;
    }

    const user = this.entityManager.create(PgUserEntity, {
      email,
      hash: hash.value,
      role: NestAuth.UserRole.ADMIN,
    });

    await this.entityManager.persist(user).flush();
  }
}
