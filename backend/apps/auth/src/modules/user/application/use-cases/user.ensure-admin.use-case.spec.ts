import { NestAuth } from '@backend/proto';
import { UserRepository } from '@modules/user/domain/repositories/user.repository';
import { ConflictException, InternalServerErrorException } from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import { UserCreateOneUseCase } from './user.create-one.use-case';
import { UserEnsureAdminUseCase } from './user.ensure-admin.use-case';

const admin = { email: 'admin@example.com', password: 'secret' };

const createdAdmin: NestAuth.User = {
  id: '01JQ0000000000000000000000',
  email: admin.email,
  role: NestAuth.UserRole.ADMIN,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('UserEnsureAdminUseCase', () => {
  let isExists: jest.Mock;
  let createOne: jest.Mock;
  let useCase: UserEnsureAdminUseCase;

  beforeEach(() => {
    isExists = jest.fn().mockResolvedValue(false);
    createOne = jest.fn().mockResolvedValue(right(createdAdmin));

    useCase = new UserEnsureAdminUseCase(
      { isExists } as unknown as UserRepository,
      { execute: createOne } as unknown as UserCreateOneUseCase,
    );
  });

  it('leaves an existing admin alone', async () => {
    isExists.mockResolvedValue(true);

    const result = await useCase.execute(admin);

    expect(result.value).toBe(false);
    expect(isExists).toHaveBeenCalledWith({ roles: [NestAuth.UserRole.ADMIN] });
    expect(createOne).not.toHaveBeenCalled();
  });

  it('creates the admin through the regular create while there is none', async () => {
    const result = await useCase.execute(admin);

    expect(result.value).toBe(true);
    expect(createOne).toHaveBeenCalledWith({ ...admin, role: NestAuth.UserRole.ADMIN });
  });

  it('counts the admin a concurrent start created first', async () => {
    isExists.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    createOne.mockResolvedValue(left(new ConflictException('User already exists')));

    const result = await useCase.execute(admin);

    expect(result.isRight()).toBe(true);
    expect(result.value).toBe(false);
  });

  it('refuses an email that belongs to a regular user', async () => {
    createOne.mockResolvedValue(left(new ConflictException('User already exists')));

    const result = await useCase.execute(admin);

    expect(result.isLeft()).toBe(true);
    expect((result.value as Error).message).toContain(admin.email);
  });

  it('passes any other failure through', async () => {
    const failure = new InternalServerErrorException('Hashing error');
    createOne.mockResolvedValue(left(failure));

    const result = await useCase.execute(admin);

    expect(result.value).toBe(failure);
    expect(isExists).toHaveBeenCalledTimes(1);
  });
});
