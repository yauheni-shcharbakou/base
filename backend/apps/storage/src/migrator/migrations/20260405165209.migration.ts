import { Migration } from '@mikro-orm/migrations';

export class Migration20260405165209 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "storage-objects" add column "is_folder" boolean not null default false;`);
    this.addSql(`create index "storage-objects_is_folder_index" on "storage-objects" ("is_folder");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index "storage-objects_is_folder_index";`);
    this.addSql(`alter table "storage-objects" drop column "is_folder";`);
  }

}
