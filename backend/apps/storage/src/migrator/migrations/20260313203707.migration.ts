import { Migration } from '@mikro-orm/migrations';

export class Migration20260313203707 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "files" add column "provider_id" varchar(255) null;`);
    this.addSql(`create index "files_provider_id_index" on "files" ("provider_id");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index "files_provider_id_index";`);
    this.addSql(`alter table "files" drop column "provider_id";`);
  }

}
