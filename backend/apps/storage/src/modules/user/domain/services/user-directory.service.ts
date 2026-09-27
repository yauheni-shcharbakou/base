import { Either } from '@sweet-monads/either';

/** Read access to the users `auth` holds — the one source of truth on who still exists. */
export abstract class UserDirectoryService {
  /** How many users exist at all. */
  abstract count(): Promise<Either<Error, number>>;
  /** Which of `ids` still exist. */
  abstract getExistingIds(ids: string[]): Promise<Either<Error, Set<string>>>;
}
