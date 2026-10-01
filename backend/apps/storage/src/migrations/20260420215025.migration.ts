import { Migration } from '@mikro-orm/migrations';

export class Migration20260420215025 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`alter table "images" drop constraint if exists "images_file_id_foreign";`);
    this.addSql(
      `alter table "images" add constraint "images_file_id_foreign" foreign key ("file_id") references "files" ("id") on delete cascade;`,
    );

    this.addSql(`alter table "videos" drop constraint if exists "videos_file_id_foreign";`);
    this.addSql(
      `alter table "videos" add constraint "videos_file_id_foreign" foreign key ("file_id") references "files" ("id") on delete cascade;`,
    );

    this.addSql(
      `alter table "storage-objects" drop constraint if exists "storage-objects_parent_id_foreign";`,
    );
    this.addSql(
      `alter table "storage-objects" add constraint "storage-objects_parent_id_foreign" foreign key ("parent_id") references "storage-objects" ("id") on delete set null;`,
    );

    this.addSql(
      `alter table "storage-objects" drop constraint if exists "storage-objects_file_id_foreign";`,
    );
    this.addSql(
      `alter table "storage-objects" add constraint "storage-objects_file_id_foreign" foreign key ("file_id") references "files" ("id") on delete cascade;`,
    );

    this.addSql(
      `alter table "storage-objects" drop constraint if exists "storage-objects_image_id_foreign";`,
    );
    this.addSql(
      `alter table "storage-objects" add constraint "storage-objects_image_id_foreign" foreign key ("image_id") references "images" ("id") on delete cascade;`,
    );

    this.addSql(
      `alter table "storage-objects" drop constraint if exists "storage-objects_video_id_foreign";`,
    );
    this.addSql(
      `alter table "storage-objects" add constraint "storage-objects_video_id_foreign" foreign key ("video_id") references "videos" ("id") on delete cascade;`,
    );

    this.addSql(`alter table "files" drop constraint if exists "files_upload_status_check";`);
    this.addSql(
      `alter table "files" add constraint "files_upload_status_check" check ("upload_status" in ('PENDING', 'FAILED', 'READY'));`,
    );

    this.addSql(`alter table "migrations" drop constraint if exists "migrations_status_check";`);
    this.addSql(
      `alter table "migrations" add constraint "migrations_status_check" check ("status" in ('pending', 'success', 'failed'));`,
    );

    this.addSql(
      `alter table "storage-objects" drop constraint if exists "storage-objects_type_check";`,
    );
    this.addSql(
      `alter table "storage-objects" add constraint "storage-objects_type_check" check ("type" in ('FOLDER', 'FILE', 'IMAGE', 'VIDEO'));`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "images" drop constraint if exists "images_file_id_foreign";`);

    this.addSql(`alter table "videos" drop constraint if exists "videos_file_id_foreign";`);

    this.addSql(
      `alter table "storage-objects" drop constraint if exists "storage-objects_parent_id_foreign";`,
    );
    this.addSql(
      `alter table "storage-objects" drop constraint if exists "storage-objects_file_id_foreign";`,
    );
    this.addSql(
      `alter table "storage-objects" drop constraint if exists "storage-objects_image_id_foreign";`,
    );
    this.addSql(
      `alter table "storage-objects" drop constraint if exists "storage-objects_video_id_foreign";`,
    );

    this.addSql(`alter table "files" drop constraint if exists "files_upload_status_check";`);

    this.addSql(
      `alter table "images" add constraint "images_file_id_foreign" foreign key ("file_id") references "files" ("id") on update cascade on delete cascade;`,
    );

    this.addSql(`alter table "migrations" drop constraint if exists "migrations_status_check";`);

    this.addSql(
      `alter table "videos" add constraint "videos_file_id_foreign" foreign key ("file_id") references "files" ("id") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table "storage-objects" drop constraint if exists "storage-objects_type_check";`,
    );
    this.addSql(
      `alter table "storage-objects" add constraint "storage-objects_parent_id_foreign" foreign key ("parent_id") references "storage-objects" ("id") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "storage-objects" add constraint "storage-objects_file_id_foreign" foreign key ("file_id") references "files" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "storage-objects" add constraint "storage-objects_image_id_foreign" foreign key ("image_id") references "images" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "storage-objects" add constraint "storage-objects_video_id_foreign" foreign key ("video_id") references "videos" ("id") on update cascade on delete cascade;`,
    );
  }
}
