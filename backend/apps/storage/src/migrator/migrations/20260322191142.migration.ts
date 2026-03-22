import { Migration } from '@mikro-orm/migrations';

export class Migration20260322191142 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create index "storage-objects_name_index" on "storage-objects" ("name");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index "storage-objects_name_index";`);
  }

}
