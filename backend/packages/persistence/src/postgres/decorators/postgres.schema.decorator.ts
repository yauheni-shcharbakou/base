import { Entity, EntityOptions } from '@mikro-orm/core';

type Options = Omit<EntityOptions<any>, 'tableName'> & {
  tableName: string;
};

export const PostgresSchema = ({ tableName, ...rest }: Options): ClassDecorator => {
  return Entity({ tableName, ...rest });
};
