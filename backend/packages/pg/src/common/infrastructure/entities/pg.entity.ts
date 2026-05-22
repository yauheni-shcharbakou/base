import type { NestCommon } from '@backend/proto';
import { OptionalProps } from '@mikro-orm/core';
import { Entity, PrimaryKey } from '@mikro-orm/decorators/legacy';
import { PgProp } from '../decorators';
import { pgId } from '../utils';

@Entity({ abstract: true })
export abstract class PgEntity<OptProps = never> implements NestCommon.Entity {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | OptProps;

  @PrimaryKey({ type: 'string' })
  readonly id: string = pgId();

  @PgProp.Date({ index: true })
  createdAt: Date = new Date();

  @PgProp.Date({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
