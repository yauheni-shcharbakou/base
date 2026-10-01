import { CacheService, MemoryCacheStore } from '@backend/cache';
import { AuthTokenPayloadParsed } from '@backend/common';
import { NestAuth } from '@backend/proto';
import { AuthTokenService } from '@modules/auth/domain/services/auth.token.service';
import { UserRepository } from '@modules/user/domain/repositories/user.repository';
import { NotFoundException } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import { AuthGetUserByTokenUseCase } from './auth.get-user-by-token.use-case';

const USER_ID = '01JQ0000000000000000000000';
const ACCESS_TOKEN = 'access-token';

const user: NestAuth.User = {
  id: USER_ID,
  email: 'user@example.com',
  role: NestAuth.UserRole.USER,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const payload = { id: USER_ID, login: user.email, role: user.role } as AuthTokenPayloadParsed;

describe('AuthGetUserByTokenUseCase', () => {
  let cache: CacheService;
  let getById: jest.Mock<Promise<Either<NotFoundException, NestAuth.User>>, [string]>;
  let parseAccessTokenPayload: jest.Mock<Either<Error, AuthTokenPayloadParsed>, [string]>;
  let useCase: AuthGetUserByTokenUseCase;

  beforeEach(() => {
    // The real service over the in-memory store rather than a mock: the key layout is part of
    // what these specs are checking.
    cache = new CacheService(new MemoryCacheStore(), {
      keyPrefix: 'cache',
      namespace: 'auth:user',
    });
    getById = jest.fn().mockResolvedValue(right(user));
    parseAccessTokenPayload = jest.fn().mockReturnValue(right(payload));

    useCase = new AuthGetUserByTokenUseCase(
      { getById } as unknown as UserRepository,
      { parseAccessTokenPayload } as unknown as AuthTokenService,
      cache,
    );
  });

  it('reads the repository on a miss and caches the user under its id', async () => {
    const result = await useCase.execute({ accessToken: ACCESS_TOKEN });

    expect(result.isRight()).toBe(true);
    expect(result.value).toEqual(user);
    expect(getById).toHaveBeenCalledWith(USER_ID);
    await expect(cache.get(USER_ID)).resolves.toMatchObject({ id: USER_ID });
    expect(cache.buildKey(USER_ID)).toBe(`cache:auth:user:${USER_ID}`);
  });

  it('serves a cached user without touching the repository', async () => {
    await cache.set(USER_ID, user);

    const result = await useCase.execute({ accessToken: ACCESS_TOKEN });

    expect(result.isRight()).toBe(true);
    expect(result.value).toEqual(user);
    expect(getById).not.toHaveBeenCalled();
  });

  it('revives the timestamps the JSON round-trip flattened into strings', async () => {
    await cache.set(USER_ID, user);

    const result = await useCase.execute({ accessToken: ACCESS_TOKEN });
    const cached = result.value as NestAuth.User;

    expect(cached.createdAt).toBeInstanceOf(Date);
    expect(cached.createdAt.toISOString()).toBe(user.createdAt.toISOString());
    expect(cached.updatedAt).toBeUndefined();
  });

  it('touches neither the cache nor the repository when the token does not parse', async () => {
    parseAccessTokenPayload.mockReturnValue(left(new Error('invalid')));
    const get = jest.spyOn(cache, 'get');

    const result = await useCase.execute({ accessToken: ACCESS_TOKEN });

    expect(result.isLeft()).toBe(true);
    expect(get).not.toHaveBeenCalled();
    expect(getById).not.toHaveBeenCalled();
  });

  it('caches nothing when the user is not found', async () => {
    getById.mockResolvedValue(left(new NotFoundException()));

    const result = await useCase.execute({ accessToken: ACCESS_TOKEN });

    expect(result.isLeft()).toBe(true);
    await expect(cache.has(USER_ID)).resolves.toBe(false);
  });
});
