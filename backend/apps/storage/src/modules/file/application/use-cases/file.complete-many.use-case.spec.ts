import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { NestStorage } from '@backend/proto';
import { FileCompletionService } from '@modules/file/application/services/file.completion.service';
import { FileRepository } from '@modules/file/domain/repositories/file.repository';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { left, right } from '@sweet-monads/either';
import { FileCompleteManyUseCase } from './file.complete-many.use-case';

const file = (id: string) => ({ id, providerId: `dev/${id}`, size: 1 }) as NestStorage.File;

describe('FileCompleteManyUseCase', () => {
  let repository: { getMany: Mock };
  let completion: { complete: Mock };
  let useCase: FileCompleteManyUseCase;

  beforeEach(() => {
    repository = { getMany: vi.fn().mockResolvedValue([file('a'), file('b'), file('c')]) };
    completion = {
      complete: vi.fn((row: NestStorage.File) =>
        Promise.resolve(
          row.id === 'b'
            ? left(new ConflictException('File has not been uploaded yet'))
            : right(row),
        ),
      ),
    };

    useCase = new FileCompleteManyUseCase(
      repository as unknown as FileRepository,
      completion as unknown as FileCompletionService,
    );
  });

  it('completes each file on its own, answering in request order', async () => {
    const result = await useCase.execute({ ids: ['c', 'b', 'a'], userId: 'u' });

    expect(repository.getMany).toHaveBeenCalledWith({ ids: ['c', 'b', 'a'], userId: 'u' });

    const completions = result.isRight() ? result.value : [];

    expect(completions.map(({ id }) => id)).toEqual(['c', 'b', 'a']);
    expect(completions.map(({ result }) => result.isRight())).toEqual([true, false, true]);
    expect(completions[1].result.value).toBeInstanceOf(ConflictException);
  });

  it('answers a missing file as not found without touching the rest', async () => {
    const result = await useCase.execute({ ids: ['a', 'x'] });
    const completions = result.isRight() ? result.value : [];

    expect(completions[0].result.isRight()).toBe(true);
    expect(completions[1].result.value).toBeInstanceOf(NotFoundException);
    expect(completion.complete).toHaveBeenCalledTimes(1);
  });

  it('completes a repeated id once and answers it at every place', async () => {
    const result = await useCase.execute({ ids: ['a', 'a'] });
    const completions = result.isRight() ? result.value : [];

    expect(completion.complete).toHaveBeenCalledTimes(1);
    expect(completions).toHaveLength(2);
    expect(completions[1].result.value).toEqual(file('a'));
  });

  it('refuses an empty list', async () => {
    const result = await useCase.execute({ ids: [] });

    expect(result.value).toBeInstanceOf(BadRequestException);
    expect(repository.getMany).not.toHaveBeenCalled();
  });
});
