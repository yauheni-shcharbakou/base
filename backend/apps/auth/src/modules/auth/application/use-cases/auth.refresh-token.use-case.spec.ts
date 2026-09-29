import { NestAuth } from '@backend/proto';
import {
  AuthRefreshTokenPayloadParsed,
  AuthSession,
} from '@modules/auth/domain/interfaces/auth.interface';
import { AuthSessionRepository } from '@modules/auth/domain/repositories/auth.session.repository';
import { AuthTokenService } from '@modules/auth/domain/services/auth.token.service';
import { UserRepository } from '@modules/user/domain/repositories/user.repository';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import { AuthRefreshTokenUseCase } from './auth.refresh-token.use-case';

const USER_ID = '01JQ0000000000000000000000';
const TOKEN_ID = 'session-token-id';
const REFRESH_TOKEN = 'refresh-token';

const user: NestAuth.User = {
  id: USER_ID,
  email: 'user@example.com',
  role: NestAuth.UserRole.ADMIN,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const session: AuthSession = {
  id: '01JQ0000000000000000000001',
  userId: USER_ID,
  tokenId: TOKEN_ID,
  expiredAt: new Date('2026-01-02T00:00:00.000Z'),
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const tokens: NestAuth.AuthTokens = {
  accessToken: { value: 'new-access', expiredAt: new Date('2026-01-01T01:00:00.000Z') },
  refreshToken: { value: 'new-refresh', expiredAt: new Date('2026-01-08T00:00:00.000Z') },
};

const payload = {
  id: USER_ID,
  login: user.email,
  role: user.role,
  jti: TOKEN_ID,
} as AuthRefreshTokenPayloadParsed;

describe('AuthRefreshTokenUseCase', () => {
  let parseRefreshTokenPayload: jest.Mock;
  let generateTokens: jest.Mock;
  let getOne: jest.Mock;
  let updateById: jest.Mock;
  let useCase: AuthRefreshTokenUseCase;

  beforeEach(() => {
    parseRefreshTokenPayload = jest.fn().mockReturnValue(right(payload));
    generateTokens = jest.fn().mockResolvedValue(right(tokens));
    getOne = jest.fn().mockResolvedValue(right(session));
    updateById = jest.fn().mockResolvedValue(right(session));

    useCase = new AuthRefreshTokenUseCase(
      { getById: jest.fn().mockResolvedValue(right(user)) } as unknown as UserRepository,
      { parseRefreshTokenPayload, generateTokens } as unknown as AuthTokenService,
      { getOne, updateById } as unknown as AuthSessionRepository,
    );
  });

  it('issues tokens for the same session and extends it to the new refresh token', async () => {
    const result = await useCase.execute({ refreshToken: REFRESH_TOKEN });

    expect(result.isRight()).toBe(true);
    expect(result.value).toEqual({ user, tokens });
    expect(getOne).toHaveBeenCalledWith({ tokenId: TOKEN_ID });
    expect(generateTokens).toHaveBeenCalledWith(expect.objectContaining({ id: USER_ID }), TOKEN_ID);
    expect(updateById).toHaveBeenCalledWith(session.id, {
      set: { expiredAt: tokens.refreshToken.expiredAt },
    });
  });

  it('refuses a token that does not verify', async () => {
    parseRefreshTokenPayload.mockReturnValue(left(new Error('Invalid refresh token')));

    const result = await useCase.execute({ refreshToken: REFRESH_TOKEN });

    expect(result.value).toBeInstanceOf(ForbiddenException);
    expect(getOne).not.toHaveBeenCalled();
  });

  it('refuses a token whose session was ended by a logout', async () => {
    getOne.mockResolvedValue(left(new NotFoundException('Session not found')));

    const result = await useCase.execute({ refreshToken: REFRESH_TOKEN });

    expect(result.value).toBeInstanceOf(ForbiddenException);
    expect(generateTokens).not.toHaveBeenCalled();
  });

  it('refuses a token whose session belongs to another user', async () => {
    getOne.mockResolvedValue(right({ ...session, userId: 'someone-else' }));

    const result = await useCase.execute({ refreshToken: REFRESH_TOKEN });

    expect(result.value).toBeInstanceOf(ForbiddenException);
    expect(generateTokens).not.toHaveBeenCalled();
  });

  it('withholds the new tokens when a logout deleted the session meanwhile', async () => {
    updateById.mockResolvedValue(left(new NotFoundException('Session not found')));

    const result = await useCase.execute({ refreshToken: REFRESH_TOKEN });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ForbiddenException);
  });
});
