import { AuthRefreshTokenPayloadParsed } from '@modules/auth/domain/interfaces/auth.interface';
import { AuthSessionRepository } from '@modules/auth/domain/repositories/auth.session.repository';
import { AuthTokenService } from '@modules/auth/domain/services/auth.token.service';
import { NotFoundException } from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import { AuthLogoutUseCase } from './auth.logout.use-case';

const TOKEN_ID = 'session-token-id';
const payload = { id: 'user-id', jti: TOKEN_ID } as AuthRefreshTokenPayloadParsed;

describe('AuthLogoutUseCase', () => {
  let parseRefreshTokenPayload: jest.Mock;
  let deleteOne: jest.Mock;
  let useCase: AuthLogoutUseCase;

  beforeEach(() => {
    parseRefreshTokenPayload = jest.fn().mockReturnValue(right(payload));
    deleteOne = jest.fn().mockResolvedValue(right({}));

    useCase = new AuthLogoutUseCase(
      { parseRefreshTokenPayload } as unknown as AuthTokenService,
      { deleteOne } as unknown as AuthSessionRepository,
    );
  });

  it("deletes the token's session", async () => {
    const result = await useCase.execute({ refreshToken: 'refresh-token' });

    expect(result.isRight()).toBe(true);
    expect(deleteOne).toHaveBeenCalledWith({ tokenId: TOKEN_ID });
  });

  it('succeeds without a delete for a token that no longer verifies', async () => {
    parseRefreshTokenPayload.mockReturnValue(left(new Error('Invalid refresh token')));

    const result = await useCase.execute({ refreshToken: 'expired' });

    expect(result.isRight()).toBe(true);
    expect(deleteOne).not.toHaveBeenCalled();
  });

  it('succeeds for a session that is already gone', async () => {
    deleteOne.mockResolvedValue(left(new NotFoundException('Session not found')));

    expect((await useCase.execute({ refreshToken: 'refresh-token' })).isRight()).toBe(true);
  });

  it('fails when the delete itself fails', async () => {
    const failure = new Error('connection terminated');
    deleteOne.mockResolvedValue(left(failure));

    const result = await useCase.execute({ refreshToken: 'refresh-token' });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBe(failure);
  });
});
