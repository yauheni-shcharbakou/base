import { InternalServerErrorException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';

export abstract class CryptoService {
  abstract hash(input: string): Promise<Either<InternalServerErrorException, string>>;
  abstract compare(decrypted: string, encrypted: string): Promise<boolean>;
}
