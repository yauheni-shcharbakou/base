import { Migration } from '@mikro-orm/migrations';

export class Migration20260926233417 extends Migration {
  override up(): void | Promise<void> {
    // `folderPath` is now a formula computed from `parent_id` + `name` on read; a stored copy could
    // only drift from the tree.
    this.addSql(`alter table "storage-objects" drop column "folder_path";`);

    // The subtree walks (the `isPublic` cascade, the delete mark, the cleanup sweep) step down one
    // level at a time by `parent_id`.
    this.addSql(
      `create index "storage-objects_parent_id_index" on "storage-objects" ("parent_id");`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`drop index "storage-objects_parent_id_index";`);
    this.addSql(`alter table "storage-objects" add "folder_path" varchar(255) null;`);

    // Code from before this migration reads the column, so rebuild it from the tree rather than
    // leave it empty: '/' for a root folder, the chain of names below it for the rest; leaves keep
    // null, as they always had.
    this.addSql(`
      with recursive tree as (
          select id, '/'::text as path
          from "storage-objects"
          where is_folder = true and parent_id is null

          union

          select c.id, t.path || c.name || '/'
          from "storage-objects" c
          inner join tree t on c.parent_id = t.id
          where c.is_folder = true
      )
      update "storage-objects" o
        set folder_path = t.path
        from tree t
        where o.id = t.id;
    `);
  }
}
