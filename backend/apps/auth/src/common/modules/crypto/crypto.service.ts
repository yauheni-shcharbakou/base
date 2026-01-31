import { InternalServerErrorException } from '@nestjs/common';
import { Either } from '@sweet-monads/either';

export interface CryptoService {
  hash(input: string): Promise<Either<InternalServerErrorException, string>>;
  compare(decrypted: string, encrypted: string): Promise<boolean>;
}

export const CRYPTO_SERVICE = Symbol('CryptoService');
