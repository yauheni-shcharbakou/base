import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { NestAuth } from '@backend/proto';
import {
  AuthRefreshTokenPayloadParsed,
  AuthSession,
} from '@modules/auth/domain/interfaces/auth.interface';
import { AuthSessionRepository } from '@modules/auth/domain/repositories/auth.session.repository';
import { AuthTokenService } from '@modules/auth/domain/services/auth.token.service';
import { UserRepository } from '@modules/user/domain/repositories/user.repository';
import { ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import { AuthRefreshTokenUseCase } from './auth.refresh-token.use-case';

const USER_ID = '01JQ0000000000000000000000';
const SESSION_ID = '01JQ0000000000000000000001';
const TOKEN_ID = 'current-token-id';
const REFRESH_TOKEN = 'refresh-token';

const user: NestAuth.User = {
  id: USER_ID,
  email: 'user@example.com',
  role: NestAuth.UserRole.ADMIN,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const session: AuthSession = {
  id: SESSION_ID,
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
  sid: SESSION_ID,
  jti: TOKEN_ID,
} as AuthRefreshTokenPayloadParsed;

describe('AuthRefreshTokenUseCase', () => {
  let parseRefreshTokenPayload: Mock;
  let generateTokens: Mock;
  let getById: Mock;
  let rotateToken: Mock;
  let deleteById: Mock;
  let useCase: AuthRefreshTokenUseCase;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    parseRefreshTokenPayload = vi.fn().mockReturnValue(right(payload));
    generateTokens = vi.fn().mockResolvedValue(right(tokens));
    getById = vi.fn().mockResolvedValue(right(session));
    rotateToken = vi.fn().mockResolvedValue(true);
    deleteById = vi.fn().mockResolvedValue(right(session));

    useCase = new AuthRefreshTokenUseCase(
      { getById: vi.fn().mockResolvedValue(right(user)) } as unknown as UserRepository,
      { parseRefreshTokenPayload, generateTokens } as unknown as AuthTokenService,
      { getById, rotateToken, deleteById } as unknown as AuthSessionRepository,
    );
  });

  afterEach(() => vi.restoreAllMocks());

  it('replaces the spent token with a new one of the same session', async () => {
    const result = await useCase.execute({ refreshToken: REFRESH_TOKEN });

    expect(result.isRight()).toBe(true);
    expect(result.value).toEqual({ user, tokens });
    expect(getById).toHaveBeenCalledWith(SESSION_ID);

    const [, signedFor] = generateTokens.mock.calls[0];

    expect(signedFor.sessionId).toBe(SESSION_ID);
    expect(signedFor.tokenId).not.toBe(TOKEN_ID);
    expect(rotateToken).toHaveBeenCalledWith(SESSION_ID, TOKEN_ID, {
      tokenId: signedFor.tokenId,
      expiredAt: tokens.refreshToken.expiredAt,
    });
    expect(deleteById).not.toHaveBeenCalled();
  });

  it('refuses a token that does not verify', async () => {
    parseRefreshTokenPayload.mockReturnValue(left(new Error('Invalid refresh token')));

    const result = await useCase.execute({ refreshToken: REFRESH_TOKEN });

    expect(result.value).toBeInstanceOf(ForbiddenException);
    expect(getById).not.toHaveBeenCalled();
  });

  it('refuses a token whose session was ended by a logout', async () => {
    getById.mockResolvedValue(left(new NotFoundException('Session not found')));

    const result = await useCase.execute({ refreshToken: REFRESH_TOKEN });

    expect(result.value).toBeInstanceOf(ForbiddenException);
    expect(generateTokens).not.toHaveBeenCalled();
  });

  it('refuses a token whose session belongs to another user', async () => {
    getById.mockResolvedValue(right({ ...session, userId: 'someone-else' }));

    const result = await useCase.execute({ refreshToken: REFRESH_TOKEN });

    expect(result.value).toBeInstanceOf(ForbiddenException);
    expect(generateTokens).not.toHaveBeenCalled();
    expect(deleteById).not.toHaveBeenCalled();
  });

  it('ends the session when a replaced token is presented again', async () => {
    getById.mockResolvedValue(right({ ...session, tokenId: 'a-later-token-id' }));

    const result = await useCase.execute({ refreshToken: REFRESH_TOKEN });

    expect(result.value).toBeInstanceOf(ForbiddenException);
    expect(deleteById).toHaveBeenCalledWith(SESSION_ID);
    expect(generateTokens).not.toHaveBeenCalled();
  });

  it('ends the session when another refresh spent the same token first', async () => {
    rotateToken.mockResolvedValue(false);

    const result = await useCase.execute({ refreshToken: REFRESH_TOKEN });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ForbiddenException);
    expect(deleteById).toHaveBeenCalledWith(SESSION_ID);
  });

  it('still refuses when the reused session cannot be deleted, and logs it', async () => {
    getById.mockResolvedValue(right({ ...session, tokenId: 'a-later-token-id' }));
    deleteById.mockResolvedValue(left(new Error('connection terminated')));

    const result = await useCase.execute({ refreshToken: REFRESH_TOKEN });

    expect(result.value).toBeInstanceOf(ForbiddenException);
    expect(Logger.prototype.error).toHaveBeenCalled();
  });
});
