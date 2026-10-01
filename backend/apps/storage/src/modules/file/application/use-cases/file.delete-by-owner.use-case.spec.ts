import { FileDropService } from '@modules/file/application/services/file.drop.service';
import { FileRepository, FileWithMedia } from '@modules/file/domain/repositories/file.repository';
import { FileDeleteByOwnerUseCase } from './file.delete-by-owner.use-case';

const USER_ID = 'owner';

const batch = (...ids: string[]) => ids.map((id) => ({ id })) as FileWithMedia[];

describe('FileDeleteByOwnerUseCase', () => {
  let repository: { getManyByOwner: jest.Mock };
  let dropService: { drop: jest.Mock };
  let useCase: FileDeleteByOwnerUseCase;

  beforeEach(() => {
    repository = { getManyByOwner: jest.fn() };
    dropService = { drop: jest.fn().mockResolvedValue(true) };
    useCase = new FileDeleteByOwnerUseCase(
      repository as unknown as FileRepository,
      dropService as unknown as FileDropService,
    );
  });

  it('drops batch after batch until the owner has no file left', async () => {
    repository.getManyByOwner
      .mockResolvedValueOnce(batch('f1', 'f2'))
      .mockResolvedValueOnce(batch('f3'))
      .mockResolvedValueOnce([]);

    const result = await useCase.execute(USER_ID);

    expect(result.isRight() && result.value).toBe(3);
    expect(repository.getManyByOwner).toHaveBeenCalledWith(USER_ID, expect.any(Number));
    expect(dropService.drop).toHaveBeenNthCalledWith(1, batch('f1', 'f2'));
    expect(dropService.drop).toHaveBeenNthCalledWith(2, batch('f3'));
  });

  it('succeeds with nothing to drop', async () => {
    repository.getManyByOwner.mockResolvedValue([]);

    const result = await useCase.execute(USER_ID);

    expect(result.isRight() && result.value).toBe(0);
    expect(dropService.drop).not.toHaveBeenCalled();
  });

  it('does not count a batch a concurrent sweep took first', async () => {
    repository.getManyByOwner.mockResolvedValueOnce(batch('f1')).mockResolvedValueOnce([]);
    dropService.drop.mockResolvedValue(false);

    const result = await useCase.execute(USER_ID);

    expect(result.isRight() && result.value).toBe(0);
  });

  it('reports a failed drop so the event is retried', async () => {
    const error = new Error('db down');
    repository.getManyByOwner.mockResolvedValue(batch('f1'));
    dropService.drop.mockRejectedValue(error);

    const result = await useCase.execute(USER_ID);

    expect(result.isLeft() && result.value).toBe(error);
  });
});
