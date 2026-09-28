import { Migration } from '@mikro-orm/migrations';

export class Migration20260226211447 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "migrations" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "name" varchar(255) not null, "status" text check ("status" in ('pending', 'success', 'failed')) not null, "error_message" varchar(255) null, "error_stack" varchar(255) null, constraint "migrations_pkey" primary key ("id"));`,
    );
    this.addSql(`create index "migrations_created_at_index" on "migrations" ("created_at");`);
    this.addSql(`create index "migrations_name_index" on "migrations" ("name");`);
    this.addSql(
      `alter table "migrations" add constraint "migrations_name_unique" unique ("name");`,
    );
    this.addSql(`create index "migrations_status_index" on "migrations" ("status");`);

    this.addSql(
      `create table "users" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "email" varchar(255) not null, "role" text check ("role" in ('ADMIN', 'USER')) not null default 'USER', "hash" varchar(255) not null, constraint "users_pkey" primary key ("id"));`,
    );
    this.addSql(`create index "users_created_at_index" on "users" ("created_at");`);
    this.addSql(`create index "users_email_index" on "users" ("email");`);
    this.addSql(`alter table "users" add constraint "users_email_unique" unique ("email");`);
    this.addSql(`create index "users_role_index" on "users" ("role");`);
  }
}
