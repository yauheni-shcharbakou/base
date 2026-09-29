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

const tokens: NestAuth.AuthTokens = {
  accessToken: { value: 'access', expiredAt: new Date('2026-01-01T01:00:00.000Z') },
  refreshToken: { value: 'refresh', expiredAt: new Date('2026-01-08T00:00:00.000Z') },
};

describe('AuthLoginUseCase', () => {
  let compare: jest.Mock;
  let generateTokens: jest.Mock;
  let saveOne: jest.Mock;
  let useCase: AuthLoginUseCase;

  beforeEach(() => {
    compare = jest.fn().mockResolvedValue(true);
    generateTokens = jest.fn().mockResolvedValue(right(tokens));
    saveOne = jest.fn().mockResolvedValue(right({}));

    useCase = new AuthLoginUseCase(
      { getOneInternal: jest.fn().mockResolvedValue(right(user)) } as unknown as UserRepository,
      { generateTokens } as unknown as AuthTokenService,
      { compare } as unknown as CryptoService,
      { saveOne } as unknown as AuthSessionRepository,
    );
  });

  it('opens a session under the jti its refresh token carries', async () => {
    const result = await useCase.execute({ login: user.email, password: 'secret' });

    expect(result.isRight()).toBe(true);

    const tokenId = generateTokens.mock.calls[0][1];

    expect(tokenId).toEqual(expect.any(String));
    expect(saveOne).toHaveBeenCalledWith({
      user: user.id,
      tokenId,
      expiredAt: tokens.refreshToken.expiredAt,
    });
  });

  it('gives each sign-in a session of its own', async () => {
    await useCase.execute({ login: user.email, password: 'secret' });
    await useCase.execute({ login: user.email, password: 'secret' });

    expect(generateTokens.mock.calls[0][1]).not.toBe(generateTokens.mock.calls[1][1]);
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
  });
});
