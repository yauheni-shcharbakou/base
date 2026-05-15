import { EntityOptions } from '@mikro-orm/core';
import { Entity } from '@mikro-orm/decorators/legacy';

type Options = Omit<EntityOptions<any>, 'tableName'> & {
  tableName: string;
};

export const PostgresSchema = ({ tableName, ...rest }: Options) => {
  return Entity({ tableName, ...rest });
};
