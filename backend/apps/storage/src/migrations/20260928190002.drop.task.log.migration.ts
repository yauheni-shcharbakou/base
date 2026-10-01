import { Migration } from '@mikro-orm/migrations';

export class Migration20260928190002_drop_task_log extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`drop table if exists "migrations" cascade;`);
  }

  override down(): void | Promise<void> {
    this.addSql(
      `create table "migrations" ("created_at" timestamptz(6) not null, "error_message" varchar(255) null, "error_stack" varchar(255) null, "id" varchar(255) not null, "name" varchar(255) not null, "status" text not null, "updated_at" timestamptz(6) not null, primary key ("id"));`,
    );
    this.addSql(`create index "migrations_created_at_index" on "migrations" ("created_at");`);
    this.addSql(`create index "migrations_name_index" on "migrations" ("name");`);
    this.addSql(
      `alter table "migrations" add constraint "migrations_name_unique" unique ("name");`,
    );
    this.addSql(`create index "migrations_status_index" on "migrations" ("status");`);

    this.addSql(
      `alter table "migrations" add constraint "migrations_status_check" check ("status" in ('pending', 'success', 'failed'));`,
    );
  }
}
