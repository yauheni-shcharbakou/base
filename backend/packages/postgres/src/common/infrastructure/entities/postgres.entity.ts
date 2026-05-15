import { OptionalProps } from '@mikro-orm/core';
import { Entity, PrimaryKey } from '@mikro-orm/decorators/legacy';
import type { NestCommon } from '@backend/proto';
import { postgresId } from '../utils';
import { PostgresProp } from '../decorators';

@Entity({ abstract: true })
export abstract class PostgresEntity<OptionalProps = never> implements NestCommon.Entity {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | OptionalProps;

  @PrimaryKey({ type: 'string' })
  readonly id: string = postgresId();

  @PostgresProp.Date({ index: true })
  createdAt: Date = new Date();

  @PostgresProp.Date({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
