import { Migration } from '@mikro-orm/migrations';

export class Migration20260329150135 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "temp-codes" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" varchar(255) not null, "code" varchar(255) not null, "is_active" boolean not null, "expired_at" timestamptz not null, constraint "temp-codes_pkey" primary key ("id"));`);
    this.addSql(`create index "temp-codes_created_at_index" on "temp-codes" ("created_at");`);
    this.addSql(`create index "temp-codes_user_id_index" on "temp-codes" ("user_id");`);
    this.addSql(`create index "temp-codes_expired_at_index" on "temp-codes" ("expired_at");`);

    this.addSql(`alter table "temp-codes" add constraint "temp-codes_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "temp-codes" cascade;`);
  }

}
