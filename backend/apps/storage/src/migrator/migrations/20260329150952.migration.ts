import { Migration } from '@mikro-orm/migrations';

export class Migration20260329150952 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "files" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" varchar(255) not null, "original_name" varchar(255) not null, "size" int not null, "mime_type" varchar(255) not null, "extension" varchar(255) not null, "upload_status" text check ("upload_status" in ('PENDING', 'FAILED', 'READY')) not null default 'PENDING', "provider_id" varchar(255) null, "upload_id" varchar(255) not null, constraint "files_pkey" primary key ("id"));`,
    );
    this.addSql(`create index "files_created_at_index" on "files" ("created_at");`);
    this.addSql(`create index "files_user_id_index" on "files" ("user_id");`);
    this.addSql(`create index "files_upload_status_index" on "files" ("upload_status");`);
    this.addSql(`create index "files_provider_id_index" on "files" ("provider_id");`);

    this.addSql(
      `create table "images" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" varchar(255) not null, "file_id" varchar(255) not null, "width" int not null, "height" int not null, "alt" varchar(255) not null, "upload_id" varchar(255) not null, constraint "images_pkey" primary key ("id"));`,
    );
    this.addSql(`create index "images_created_at_index" on "images" ("created_at");`);
    this.addSql(`create index "images_user_id_index" on "images" ("user_id");`);
    this.addSql(`alter table "images" add constraint "images_file_id_unique" unique ("file_id");`);

    this.addSql(
      `create table "migrations" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "name" varchar(255) not null, "status" text check ("status" in ('pending', 'success', 'failed')) not null, "error_message" varchar(255) null, "error_stack" varchar(255) null, constraint "migrations_pkey" primary key ("id"));`,
    );
    this.addSql(`create index "migrations_created_at_index" on "migrations" ("created_at");`);
    this.addSql(`create index "migrations_name_index" on "migrations" ("name");`);
    this.addSql(
      `alter table "migrations" add constraint "migrations_name_unique" unique ("name");`,
    );
    this.addSql(`create index "migrations_status_index" on "migrations" ("status");`);

    this.addSql(
      `create table "videos" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" varchar(255) not null, "file_id" varchar(255) not null, "provider_id" varchar(255) not null, "title" varchar(255) not null, "duration" int not null default 0, "views" int not null default 0, "description" varchar(255) null, "upload_id" varchar(255) not null, constraint "videos_pkey" primary key ("id"));`,
    );
    this.addSql(`create index "videos_created_at_index" on "videos" ("created_at");`);
    this.addSql(`create index "videos_user_id_index" on "videos" ("user_id");`);
    this.addSql(`alter table "videos" add constraint "videos_file_id_unique" unique ("file_id");`);
    this.addSql(`create index "videos_provider_id_index" on "videos" ("provider_id");`);

    this.addSql(
      `create table "storage-objects" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "user_id" varchar(255) not null, "name" varchar(255) not null, "is_public" boolean not null default false, "type" text check ("type" in ('FOLDER', 'FILE', 'IMAGE', 'VIDEO')) not null, "parent_id" varchar(255) null, "file_id" varchar(255) null, "folder_path" varchar(255) null, "image_id" varchar(255) null, "video_id" varchar(255) null, constraint "storage-objects_pkey" primary key ("id"));`,
    );
    this.addSql(
      `create index "storage-objects_created_at_index" on "storage-objects" ("created_at");`,
    );
    this.addSql(`create index "storage-objects_user_id_index" on "storage-objects" ("user_id");`);
    this.addSql(`create index "storage-objects_name_index" on "storage-objects" ("name");`);
    this.addSql(
      `create index "storage-objects_is_public_index" on "storage-objects" ("is_public");`,
    );
    this.addSql(`create index "storage-objects_type_index" on "storage-objects" ("type");`);
    this.addSql(
      `alter table "storage-objects" add constraint "storage-objects_file_id_unique" unique ("file_id");`,
    );
    this.addSql(
      `alter table "storage-objects" add constraint "storage-objects_image_id_unique" unique ("image_id");`,
    );
    this.addSql(
      `alter table "storage-objects" add constraint "storage-objects_video_id_unique" unique ("video_id");`,
    );

    this.addSql(
      `alter table "images" add constraint "images_file_id_foreign" foreign key ("file_id") references "files" ("id") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table "videos" add constraint "videos_file_id_foreign" foreign key ("file_id") references "files" ("id") on update cascade on delete cascade;`,
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
