import { Migration } from '@mikro-orm/migrations';

export class Migration20260927163559 extends Migration {
  // A storage object stays inside its owner's tree, and a name is unique per folder — both now
  // enforced by the database, not only by the service's checks.
  //
  // Rows written before the service checked the owner, or while name checks still raced, may
  // already break a rule below. Those are refused up front with the ids, rather than by whichever
  // constraint happens to be created first: which object to move or rename is a human's call.
  override up(): void | Promise<void> {
    // Objects left live under a deleted folder: placement used to accept a deleted parent. Nothing
    // shows them, and the folder cleanup never reaches their folder, so they were never going to be
    // anything but garbage — mark them the way deleting the folder would have.
    this.addSql(`
      with recursive orphaned as (
          select c.id
          from "storage-objects" c
          inner join "storage-objects" p on p.id = c.parent_id
          where p.is_deleted = true and c.is_deleted = false

          union

          select c.id
          from "storage-objects" c
          inner join orphaned o on c.parent_id = o.id
      )
      update "storage-objects" set is_deleted = true, updated_at = now()
      where id in (select id from orphaned) and is_deleted = false;
    `);

    this.addSql(`
      do $$
      declare
        problems text := '';
        ids text;
      begin
        select string_agg(c.id, ', ') into ids
        from "storage-objects" c
        inner join "storage-objects" p on p.id = c.parent_id
        where p.user_id <> c.user_id;
        if ids is not null then
          problems := problems || E'\\n  placed in another user''s folder: ' || ids;
        end if;

        select string_agg(parent_id || '/' || name, ', ') into ids from (
          select parent_id, name from "storage-objects"
          where is_deleted = false and parent_id is not null
          group by parent_id, name having count(*) > 1
        ) duplicates;
        if ids is not null then
          problems := problems || E'\\n  duplicate names (parent/name): ' || ids;
        end if;

        select string_agg(id, ', ') into ids from "storage-objects"
        where strpos(name, '/') > 0 or (name = '' and parent_id is not null);
        if ids is not null then
          problems := problems || E'\\n  a name that is empty or holds ''/'': ' || ids;
        end if;

        select string_agg(id, ', ') into ids from "storage-objects"
        where parent_id = id
          or is_folder <> (type = 'FOLDER')
          or (not is_folder and parent_id is null);
        if ids is not null then
          problems := problems || E'\\n  self-parented, mistyped or unplaced: ' || ids;
        end if;

        if problems <> '' then
          raise exception 'storage-objects rows break the tree rules, fix them first:%', problems;
        end if;
      end
      $$;
    `);

    // The owner-scoped parent key replaces the plain one. `no action` rather than `set null`:
    // folders are deleted leaves first, so a parent deleted ahead of its child is a bug, and
    // `set null` turned it silently into a second root. A null `parent_id` (a root folder) is not
    // checked — the default MATCH SIMPLE.
    this.addSql(
      `alter table "storage-objects" drop constraint "storage-objects_parent_id_foreign";`,
    );
    this.addSql(
      `alter table "storage-objects" add constraint "storage-objects_owner_id_unique" unique ("user_id", "id");`,
    );
    this.addSql(
      `alter table "storage-objects" add constraint "storage-objects_parent_owner_foreign" ` +
        `foreign key ("user_id", "parent_id") references "storage-objects" ("user_id", "id") ` +
        `on update no action on delete no action;`,
    );

    // None of these is selective alone, and the ones on `is_public` / `is_deleted` rule out a HOT
    // update for every row the subtree `UPDATE`s rewrite. `user_id` is the leading column of the
    // new unique constraint.
    this.addSql(`drop index "storage-objects_is_deleted_index";`);
    this.addSql(`drop index "storage-objects_is_folder_index";`);
    this.addSql(`drop index "storage-objects_is_public_index";`);
    this.addSql(`drop index "storage-objects_name_index";`);
    this.addSql(`drop index "storage-objects_type_index";`);
    this.addSql(`drop index "storage-objects_user_id_index";`);

    // A name is unique among a folder's live objects, a folder's and a file's alike.
    this.addSql(
      `create unique index "storage-objects_name_unique" on "storage-objects" ("parent_id", "name") where "is_deleted" = false;`,
    );

    this.addSql(
      `alter table "storage-objects" add constraint "storage-objects_name_check" check (strpos("name", '/') = 0 and ("name" <> '' or "parent_id" is null));`,
    );
    this.addSql(
      `alter table "storage-objects" add constraint "storage-objects_leaf_placed_check" check ("is_folder" or "parent_id" is not null);`,
    );
    this.addSql(
      `alter table "storage-objects" add constraint "storage-objects_is_folder_check" check ("is_folder" = ("type" = 'FOLDER'));`,
    );
    this.addSql(
      `alter table "storage-objects" add constraint "storage-objects_parent_not_self_check" check ("parent_id" <> "id");`,
    );
  }

  // The objects `up` marked deleted under a deleted folder stay marked: which of them were live
  // before is not recorded, and they were unreachable either way.
  override down(): void | Promise<void> {
    this.addSql(
      `alter table "storage-objects" drop constraint "storage-objects_parent_not_self_check";`,
    );
    this.addSql(`alter table "storage-objects" drop constraint "storage-objects_is_folder_check";`);
    this.addSql(
      `alter table "storage-objects" drop constraint "storage-objects_leaf_placed_check";`,
    );
    this.addSql(`alter table "storage-objects" drop constraint "storage-objects_name_check";`);
    this.addSql(`drop index "storage-objects_name_unique";`);

    this.addSql(`create index "storage-objects_user_id_index" on "storage-objects" ("user_id");`);
    this.addSql(`create index "storage-objects_type_index" on "storage-objects" ("type");`);
    this.addSql(`create index "storage-objects_name_index" on "storage-objects" ("name");`);
    this.addSql(
      `create index "storage-objects_is_public_index" on "storage-objects" ("is_public");`,
    );
    this.addSql(
      `create index "storage-objects_is_folder_index" on "storage-objects" ("is_folder");`,
    );
    this.addSql(
      `create index "storage-objects_is_deleted_index" on "storage-objects" ("is_deleted");`,
    );

    this.addSql(
      `alter table "storage-objects" drop constraint "storage-objects_parent_owner_foreign";`,
    );
    this.addSql(`alter table "storage-objects" drop constraint "storage-objects_owner_id_unique";`);
    this.addSql(
      `alter table "storage-objects" add constraint "storage-objects_parent_id_foreign" foreign key ("parent_id") references "storage-objects" ("id") on delete set null;`,
    );
  }
}
