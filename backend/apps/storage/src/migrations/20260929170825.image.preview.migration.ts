import { Migration } from '@mikro-orm/migrations';

export class Migration20260929170825_image_preview extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table "images" add "preview_provider_id" varchar(255) null, add "preview_failed_at" timestamptz null;`,
    );
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "images" drop column "preview_provider_id", drop column "preview_failed_at";`,
    );
  }
}
