import { Migration } from '@mikro-orm/migrations';

export class Migration20261001231531_preview_attempts extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`alter table "files" add "preview_attempts" int not null default 0;`);

    this.addSql(`alter table "images" add "preview_attempts" int not null default 0;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "files" drop column "preview_attempts";`);

    this.addSql(`alter table "images" drop column "preview_attempts";`);
  }
}
