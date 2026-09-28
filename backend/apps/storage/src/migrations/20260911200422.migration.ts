import { Migration } from '@mikro-orm/migrations';

export class Migration20260911200422 extends Migration {

  // Only the `files_upload_status_check` statements belong to the UPLOADED status. The
  // `timestamptz(3)` → `timestamptz` and `varchar` → `text` recasts across the other tables are
  // pre-existing drift between the snapshot and what the entities resolve to today — they ride along
  // because leaving them behind means every future migration regenerates them. Both recasts are
  // lossless in Postgres, but they do rewrite the tables.
  //
  // `down()` re-adds the three-value constraint and therefore **fails** if any row already holds
  // 'UPLOADED'. That is deliberate: a rollback that silently left the data unconstrained is worse.
  override up(): void | Promise<void> {
    this.addSql(`alter table "files" drop constraint "files_upload_status_check";`);
    this.addSql(`alter table "files" alter column "created_at" type timestamptz using ("created_at"::timestamptz);`);
    this.addSql(`alter table "files" alter column "updated_at" type timestamptz using ("updated_at"::timestamptz);`);
    this.addSql(`alter table "files" alter column "upload_status" type text using ("upload_status"::text);`);
    this.addSql(`alter table "files" add constraint "files_upload_status_check" check ("upload_status" in ('PENDING', 'FAILED', 'READY', 'UPLOADED'));`);

    this.addSql(`alter table "images" alter column "created_at" type timestamptz using ("created_at"::timestamptz);`);
    this.addSql(`alter table "images" alter column "updated_at" type timestamptz using ("updated_at"::timestamptz);`);

    this.addSql(`alter table "migrations" alter column "created_at" type timestamptz using ("created_at"::timestamptz);`);
    this.addSql(`alter table "migrations" alter column "status" type text using ("status"::text);`);
    this.addSql(`alter table "migrations" alter column "updated_at" type timestamptz using ("updated_at"::timestamptz);`);

    this.addSql(`alter table "videos" alter column "created_at" type timestamptz using ("created_at"::timestamptz);`);
    this.addSql(`alter table "videos" alter column "updated_at" type timestamptz using ("updated_at"::timestamptz);`);

    this.addSql(`alter table "storage-objects" alter column "created_at" type timestamptz using ("created_at"::timestamptz);`);
    this.addSql(`alter table "storage-objects" alter column "type" type text using ("type"::text);`);
    this.addSql(`alter table "storage-objects" alter column "updated_at" type timestamptz using ("updated_at"::timestamptz);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "files" drop constraint "files_upload_status_check";`);
    this.addSql(`alter table "files" alter column "created_at" type timestamptz(3) using ("created_at"::timestamptz(3));`);
    this.addSql(`alter table "files" alter column "updated_at" type timestamptz(3) using ("updated_at"::timestamptz(3));`);
    this.addSql(`alter table "files" alter column "upload_status" type varchar using ("upload_status"::varchar);`);
    this.addSql(`alter table "files" add constraint "files_upload_status_check" check ("upload_status" in ('PENDING', 'FAILED', 'READY'));`);

    this.addSql(`alter table "images" alter column "created_at" type timestamptz(3) using ("created_at"::timestamptz(3));`);
    this.addSql(`alter table "images" alter column "updated_at" type timestamptz(3) using ("updated_at"::timestamptz(3));`);

    this.addSql(`alter table "migrations" alter column "created_at" type timestamptz(3) using ("created_at"::timestamptz(3));`);
    this.addSql(`alter table "migrations" alter column "updated_at" type timestamptz(3) using ("updated_at"::timestamptz(3));`);
    this.addSql(`alter table "migrations" alter column "status" type varchar using ("status"::varchar);`);

    this.addSql(`alter table "storage-objects" alter column "created_at" type timestamptz(3) using ("created_at"::timestamptz(3));`);
    this.addSql(`alter table "storage-objects" alter column "updated_at" type timestamptz(3) using ("updated_at"::timestamptz(3));`);
    this.addSql(`alter table "storage-objects" alter column "type" type varchar using ("type"::varchar);`);

    this.addSql(`alter table "videos" alter column "created_at" type timestamptz(3) using ("created_at"::timestamptz(3));`);
    this.addSql(`alter table "videos" alter column "updated_at" type timestamptz(3) using ("updated_at"::timestamptz(3));`);
  }

}
