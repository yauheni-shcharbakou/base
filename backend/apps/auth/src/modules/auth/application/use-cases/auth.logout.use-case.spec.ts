import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { AuthRefreshTokenPayloadParsed } from '@modules/auth/domain/interfaces/auth.interface';
import { AuthSessionRepository } from '@modules/auth/domain/repositories/auth.session.repository';
import { AuthTokenService } from '@modules/auth/domain/services/auth.token.service';
import { NotFoundException } from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import { AuthLogoutUseCase } from './auth.logout.use-case';

const SESSION_ID = '01JQ0000000000000000000001';
const payload = {
  id: 'user-id',
  sid: SESSION_ID,
  jti: 'token-id',
} as AuthRefreshTokenPayloadParsed;

describe('AuthLogoutUseCase', () => {
  let parseRefreshTokenPayload: Mock;
  let deleteById: Mock;
  let useCase: AuthLogoutUseCase;

  beforeEach(() => {
    parseRefreshTokenPayload = vi.fn().mockReturnValue(right(payload));
    deleteById = vi.fn().mockResolvedValue(right({}));

    useCase = new AuthLogoutUseCase(
      { parseRefreshTokenPayload } as unknown as AuthTokenService,
      { deleteById } as unknown as AuthSessionRepository,
    );
  });

  it("deletes the token's session by its id, whichever of its tokens it is", async () => {
    const result = await useCase.execute({ refreshToken: 'refresh-token' });

    expect(result.isRight()).toBe(true);
    expect(deleteById).toHaveBeenCalledWith(SESSION_ID);
  });

  it('succeeds without a delete for a token that no longer verifies', async () => {
    parseRefreshTokenPayload.mockReturnValue(left(new Error('Invalid refresh token')));

    const result = await useCase.execute({ refreshToken: 'expired' });

    expect(result.isRight()).toBe(true);
    expect(deleteById).not.toHaveBeenCalled();
  });

  it('succeeds for a session that is already gone', async () => {
    deleteById.mockResolvedValue(left(new NotFoundException('Session not found')));

    expect((await useCase.execute({ refreshToken: 'refresh-token' })).isRight()).toBe(true);
  });

  it('fails when the delete itself fails', async () => {
    const failure = new Error('connection terminated');
    deleteById.mockResolvedValue(left(failure));

    const result = await useCase.execute({ refreshToken: 'refresh-token' });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBe(failure);
  });
});
