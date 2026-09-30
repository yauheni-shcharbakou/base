import { NestAuth } from '@backend/proto';
import { AuthSessionRepository } from '@modules/auth/domain/repositories/auth.session.repository';
import { AuthTokenService } from '@modules/auth/domain/services/auth.token.service';
import { CryptoService } from '@modules/crypto/domain/services/crypto.service';
import { UserRepository } from '@modules/user/domain/repositories/user.repository';
import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import { AuthLoginUseCase } from './auth.login.use-case';

const user = {
  id: '01JQ0000000000000000000000',
  email: 'user@example.com',
  role: NestAuth.UserRole.ADMIN,
  hash: 'hash',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const SESSION_ID = '01JQ0000000000000000000001';

const tokens: NestAuth.AuthTokens = {
  accessToken: { value: 'access', expiredAt: new Date('2026-01-01T01:00:00.000Z') },
  refreshToken: { value: 'refresh', expiredAt: new Date('2026-01-08T00:00:00.000Z') },
};

describe('AuthLoginUseCase', () => {
  let compare: jest.Mock;
  let generateTokens: jest.Mock;
  let saveOne: jest.Mock;
  let updateById: jest.Mock;
  let useCase: AuthLoginUseCase;

  beforeEach(() => {
    compare = jest.fn().mockResolvedValue(true);
    generateTokens = jest.fn().mockResolvedValue(right(tokens));
    saveOne = jest.fn().mockResolvedValue(right({ id: SESSION_ID }));
    updateById = jest.fn().mockResolvedValue(right({ id: SESSION_ID }));

    useCase = new AuthLoginUseCase(
      { getOneInternal: jest.fn().mockResolvedValue(right(user)) } as unknown as UserRepository,
      { generateTokens } as unknown as AuthTokenService,
      { compare } as unknown as CryptoService,
      { saveOne, updateById } as unknown as AuthSessionRepository,
    );
  });

  it('opens a session and signs its id and token id into the refresh token', async () => {
    const result = await useCase.execute({ login: user.email, password: 'secret' });

    expect(result.isRight()).toBe(true);

    const [{ tokenId }] = saveOne.mock.calls[0];

    expect(saveOne).toHaveBeenCalledWith({ user: user.id, tokenId, expiredAt: expect.any(Date) });
    expect(generateTokens).toHaveBeenCalledWith(expect.objectContaining({ id: user.id }), {
      sessionId: SESSION_ID,
      tokenId,
    });
    // Until the tokens exist the session expires at once; then it lives as long as they do.
    expect(updateById).toHaveBeenCalledWith(SESSION_ID, {
      set: { expiredAt: tokens.refreshToken.expiredAt },
    });
  });

  it('gives each sign-in a session of its own', async () => {
    await useCase.execute({ login: user.email, password: 'secret' });
    await useCase.execute({ login: user.email, password: 'secret' });

    expect(saveOne.mock.calls[0][0].tokenId).not.toBe(saveOne.mock.calls[1][0].tokenId);
  });

  it('opens no session for a wrong password', async () => {
    compare.mockResolvedValue(false);

    const result = await useCase.execute({ login: user.email, password: 'wrong' });

    expect(result.value).toBeInstanceOf(ForbiddenException);
    expect(saveOne).not.toHaveBeenCalled();
  });

  it('returns no tokens when the session cannot be saved', async () => {
    saveOne.mockResolvedValue(left(new Error('connection terminated')));

    const result = await useCase.execute({ login: user.email, password: 'secret' });

    expect(result.value).toBeInstanceOf(InternalServerErrorException);
    expect(generateTokens).not.toHaveBeenCalled();
  });

  it('returns no tokens when the session cannot be given their lifetime', async () => {
    updateById.mockResolvedValue(left(new Error('connection terminated')));

    const result = await useCase.execute({ login: user.email, password: 'secret' });

    expect(result.value).toBeInstanceOf(InternalServerErrorException);
  });
});
