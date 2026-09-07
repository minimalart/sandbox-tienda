import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260618000001 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "vimeo_video" add column if not exists "poster_url" text null;`
    );
    this.addSql(
      `alter table "vimeo_video" add column if not exists "show_in_carousel" boolean not null default true;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "vimeo_video" drop column if exists "poster_url";`);
    this.addSql(`alter table "vimeo_video" drop column if exists "show_in_carousel";`);
  }
}
