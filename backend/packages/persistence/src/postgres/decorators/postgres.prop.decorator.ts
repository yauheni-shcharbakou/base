import { Dictionary, EnumOptions, PropertyOptions } from '@mikro-orm/core';
import { Enum, Property } from '@mikro-orm/decorators/legacy';

type EnumOpts = EnumOptions<Dictionary> & { enum: Dictionary };

export class PostgresProp {
  static Date<T extends object>(options: PropertyOptions<T> = {}) {
    return Property({ columnType: 'timestamptz', length: 3, ...options });
  }

  static Enum({ enum: dictionary, ...options }: EnumOpts) {
    return Enum({ columnType: 'varchar', items: () => dictionary, ...options });
  }
}
