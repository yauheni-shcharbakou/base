import { Migration } from '@mikro-orm/migrations';

export class Migration20260830171342 extends Migration {
  override up(): void | Promise<void> {
    // Collapse pre-existing duplicates before the index is created, otherwise it cannot be built.
    // The earliest row wins (ULIDs are monotonic) and the children of the losers are re-parented to
    // it, so nothing is orphaned.
    this.addSql(`
      create temporary table root_folder_dupes as
        select id, first_value(id) over (partition by user_id order by id) as keeper_id
        from "storage-objects"
        where is_folder = true and parent_id is null;
    `);

    this.addSql(`delete from root_folder_dupes where id = keeper_id;`);

    this.addSql(`
      update "storage-objects" o
        set parent_id = d.keeper_id
        from root_folder_dupes d
        where o.parent_id = d.id;
    `);

    this.addSql(`delete from "storage-objects" o using root_folder_dupes d where o.id = d.id;`);

    this.addSql(`drop table root_folder_dupes;`);

    this.addSql(`
      create unique index "storage-objects_root_folder_unique"
        on "storage-objects" ("user_id")
        where "is_folder" = true and "parent_id" is null;
    `);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop index "storage-objects_root_folder_unique";`);
  }
}
