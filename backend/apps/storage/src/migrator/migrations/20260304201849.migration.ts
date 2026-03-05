import { Migration } from '@mikro-orm/migrations';

export class Migration20260304201849 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "videos" add column "title" varchar(255) not null;`);
    this.addSql(`alter table "videos" alter column "duration" type int using ("duration"::int);`);
    this.addSql(`alter table "videos" alter column "duration" set default 0;`);
    this.addSql(`alter table "videos" alter column "views" type int using ("views"::int);`);
    this.addSql(`alter table "videos" alter column "views" set default 0;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "videos" drop column "title";`);

    this.addSql(`alter table "videos" alter column "duration" drop default;`);
    this.addSql(`alter table "videos" alter column "duration" type int using ("duration"::int);`);
    this.addSql(`alter table "videos" alter column "views" drop default;`);
    this.addSql(`alter table "videos" alter column "views" type int using ("views"::int);`);
  }

}
