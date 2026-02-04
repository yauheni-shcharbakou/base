import { GrpcUserRole } from '@backend/grpc';
import { MigrationTask } from '@backend/persistence';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { UserEntity } from 'common/entities/user.entity';
import { CRYPTO_SERVICE, CryptoService } from 'common/modules/crypto/crypto.service';
import { Config } from 'config';
import { Model } from 'mongoose';

@Injectable()
export class CreateAdmin implements MigrationTask {
  constructor(
    private readonly configService: ConfigService<Config>,
    @Inject(CRYPTO_SERVICE) private readonly cryptoService: CryptoService,
    @InjectModel(UserEntity.name) private readonly userModel: Model<UserEntity>,
  ) {}

  async up() {
    const email = this.configService.getOrThrow('admin.email', { infer: true });
    const password = this.configService.getOrThrow('admin.password', { infer: true });
    const hash = await this.cryptoService.hash(password);

    if (hash.isLeft()) {
      throw hash.value;
    }

    await new this.userModel({ email, hash: hash.value, role: GrpcUserRole.ADMIN }).save();
  }
}
