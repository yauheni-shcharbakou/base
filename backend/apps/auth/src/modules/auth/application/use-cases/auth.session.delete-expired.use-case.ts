import { AuthSessionRepository } from '@modules/auth/domain/repositories/auth.session.repository';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthSessionDeleteExpiredUseCase {
  constructor(private readonly sessionRepository: AuthSessionRepository) {}

  /**
   * A session whose refresh token has expired can never be refreshed again, so its row only takes
   * room. Every sign-in adds one, so they are swept rather than left to grow.
   */
  async execute(): Promise<boolean> {
    return this.sessionRepository.deleteMany({ expiredBefore: new Date() });
  }
}
