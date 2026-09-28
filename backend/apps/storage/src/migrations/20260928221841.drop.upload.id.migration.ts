import { Migration } from '@mikro-orm/migrations';

export class Migration20260928221841_drop_upload_id extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`alter table "files" drop column "upload_id";`);

    this.addSql(`alter table "images" drop column "upload_id";`);

    this.addSql(`alter table "videos" drop column "upload_id";`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "files" add "upload_id" varchar(255) null;`);

    this.addSql(`alter table "images" add "upload_id" varchar(255) null;`);

    this.addSql(`alter table "videos" add "upload_id" varchar(255) null;`);
  }
}
