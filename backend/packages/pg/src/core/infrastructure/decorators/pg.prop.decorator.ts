import { Dictionary, EnumOptions, PropertyOptions } from '@mikro-orm/core';
import { Enum, Property } from '@mikro-orm/decorators/legacy';

type EnumOpts = EnumOptions<Dictionary> & { enum: Dictionary };

export class PgProp {
  // Both values mirror what the databases already hold: every `created_at`/`updated_at` is
  // `timestamptz(6)` and every enum column is `text`, because that is what the initial migrations
  // emitted back when MikroORM ignored `length` next to an explicit `columnType`. Narrowing the
  // columns instead would rewrite the tables under an ACCESS EXCLUSIVE lock and round the stored
  // timestamps down to milliseconds, for two changes Postgres treats as no-ops (`timestamptz` is
  // 8 bytes at any precision, and `varchar` without a limit behaves exactly like `text`).
  static Date<T extends object>(options: PropertyOptions<T> = {}) {
    return Property({ columnType: 'timestamptz', length: 6, ...options });
  }

  static Enum({ enum: dictionary, ...options }: EnumOpts) {
    return Enum({ columnType: 'text', items: () => dictionary, ...options });
  }
}
