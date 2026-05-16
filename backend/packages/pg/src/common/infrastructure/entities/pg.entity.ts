import { OptionalProps } from '@mikro-orm/core';
import { Entity, PrimaryKey } from '@mikro-orm/decorators/legacy';
import type { NestCommon } from '@backend/proto';
import { pgId } from '../utils';
import { PgProp } from '../decorators';

@Entity({ abstract: true })
export abstract class PgEntity<OptionalProps = never> implements NestCommon.Entity {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | OptionalProps;

  @PrimaryKey({ type: 'string' })
  readonly id: string = pgId();

  @PgProp.Date({ index: true })
  createdAt: Date = new Date();

  @PgProp.Date({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
