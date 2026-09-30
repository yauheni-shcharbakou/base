import { Migration } from '@mikro-orm/migrations';

export class Migration20260930215955_file_preview extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table "files" add "preview_provider_id" varchar(255) null, add "preview_failed_at" timestamptz null;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "files" drop column "preview_provider_id", drop column "preview_failed_at";`,
    );
  }
}
