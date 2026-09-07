"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260618000001 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20260618000001 extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table "vimeo_video" add column if not exists "poster_url" text null;`);
        this.addSql(`alter table "vimeo_video" add column if not exists "show_in_carousel" boolean not null default true;`);
    }
    async down() {
        this.addSql(`alter table "vimeo_video" drop column if exists "poster_url";`);
        this.addSql(`alter table "vimeo_video" drop column if exists "show_in_carousel";`);
    }
}
exports.Migration20260618000001 = Migration20260618000001;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA2MTgwMDAwMDEuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy92aW1lby12aWRlby9taWdyYXRpb25zL01pZ3JhdGlvbjIwMjYwNjE4MDAwMDAxLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHlFQUFxRTtBQUVyRSxNQUFhLHVCQUF3QixTQUFRLHNCQUFTO0lBQzNDLEtBQUssQ0FBQyxFQUFFO1FBQ2YsSUFBSSxDQUFDLE1BQU0sQ0FDVCw0RUFBNEUsQ0FDN0UsQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLENBQ1Qsc0dBQXNHLENBQ3ZHLENBQUM7SUFDSixDQUFDO0lBRVEsS0FBSyxDQUFDLElBQUk7UUFDakIsSUFBSSxDQUFDLE1BQU0sQ0FBQywrREFBK0QsQ0FBQyxDQUFDO1FBQzdFLElBQUksQ0FBQyxNQUFNLENBQUMscUVBQXFFLENBQUMsQ0FBQztJQUNyRixDQUFDO0NBQ0Y7QUFkRCwwREFjQyJ9