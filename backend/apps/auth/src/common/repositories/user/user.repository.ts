import { DatabaseRepository } from '@backend/persistence';
import { UserInternal } from 'common/interfaces/user.interface';

export const USER_REPOSITORY = Symbol('UserRepository');

export interface UserRepository extends DatabaseRepository<UserInternal> {}
