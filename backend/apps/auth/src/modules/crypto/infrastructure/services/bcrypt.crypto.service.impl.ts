import { CryptoService } from '@modules/crypto/domain/services/crypto.service';
import { InternalServerErrorException } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import { compare, hash } from 'bcrypt';

export class BcryptCryptoServiceImpl implements CryptoService {
  constructor(private readonly salt: number) {}

  async hash(input: string): Promise<Either<InternalServerErrorException, string>> {
    try {
      return right(await hash(input, this.salt));
    } catch (e) {
      return left(new InternalServerErrorException('Hashing error'));
    }
  }

  async compare(decrypted: string, encrypted: string): Promise<boolean> {
    return compare(decrypted, encrypted);
  }
}
