import { Migration } from '@mikro-orm/migrations';

export class Migration20260929234739_sessions extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table "sessions" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" varchar(255) not null, "token_id" varchar(255) not null, "expired_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "sessions_created_at_index" on "sessions" ("created_at");`);
    this.addSql(`create index "sessions_user_id_index" on "sessions" ("user_id");`);
    this.addSql(`alter table "sessions" add constraint "sessions_token_id_unique" unique ("token_id");`);
    this.addSql(`create index "sessions_expired_at_index" on "sessions" ("expired_at");`);

    this.addSql(`alter table "sessions" add constraint "sessions_user_id_foreign" foreign key ("user_id") references "users" ("id") on delete cascade;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "sessions" cascade;`);
  }

}
