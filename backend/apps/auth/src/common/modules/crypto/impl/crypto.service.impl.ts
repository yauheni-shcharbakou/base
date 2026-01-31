import { InternalServerErrorException } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import { hash, compare } from 'bcrypt';
import { CryptoService } from 'common/modules/crypto/crypto.service';

export class CryptoServiceImpl implements CryptoService {
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
