import { Migration } from '@mikro-orm/migrations';

export class Migration20260522213650 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`alter table "storage-objects" add "is_deleted" boolean not null default false;`);
    this.addSql(
      `create index "storage-objects_is_deleted_index" on "storage-objects" ("is_deleted");`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop index "storage-objects_is_deleted_index";`);
    this.addSql(`alter table "storage-objects" drop column "is_deleted";`);
  }
}
