import { DatabaseRepository } from '@backend/common';
import { NestStorage } from '@backend/proto';

export abstract class FileRepository extends DatabaseRepository<
  NestStorage.File,
  NestStorage.FileQuery
> {}
