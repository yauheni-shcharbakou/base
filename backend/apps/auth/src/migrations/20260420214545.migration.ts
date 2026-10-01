import { Migration } from '@mikro-orm/migrations';

export class Migration20260420214545 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`alter table "temp-codes" drop constraint if exists "temp-codes_user_id_foreign";`);
    this.addSql(
      `alter table "temp-codes" add constraint "temp-codes_user_id_foreign" foreign key ("user_id") references "users" ("id") on delete cascade;`,
    );

    this.addSql(`alter table "migrations" drop constraint if exists "migrations_status_check";`);
    this.addSql(
      `alter table "migrations" add constraint "migrations_status_check" check ("status" in ('pending', 'success', 'failed'));`,
    );

    this.addSql(`alter table "users" drop constraint if exists "users_role_check";`);
    this.addSql(
      `alter table "users" add constraint "users_role_check" check ("role" in ('ADMIN', 'USER'));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "temp-codes" drop constraint if exists "temp-codes_user_id_foreign";`);

    this.addSql(`alter table "migrations" drop constraint if exists "migrations_status_check";`);

    this.addSql(`alter table "users" drop constraint if exists "users_role_check";`);

    this.addSql(
      `alter table "temp-codes" add constraint "temp-codes_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;`,
    );
  }
}
