import { Migration } from '@mikro-orm/migrations';

// Written by hand: an entity property cannot declare a column collation, so neither the snapshot nor
// a generated migration knows about this one. ICU compares the same way on every server, where the
// libc default does not (musl compares bytes: 'B' before 'a', 'É' after 'z'); `kn` puts 'file2'
// before 'file10'. Deterministic, like every collation created without saying otherwise: equality
// stays byte equality, so `storage-objects_name_unique` refuses the same names as before, and `ILIKE`
// — which a nondeterministic collation refuses before Postgres 18 — keeps working.
export class Migration20260929120337_natural_name_order extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`create collation "natural_order" (provider = icu, locale = 'und-u-kn');`);

    this.addSql(
      `alter table "storage-objects" alter column "name" type varchar(255) collate "natural_order";`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "storage-objects" alter column "name" type varchar(255) collate "default";`,
    );

    this.addSql(`drop collation "natural_order";`);
  }
}
