"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260618010000 = void 0;
const migrations_1 = require("@mikro-orm/migrations");
class Migration20260618010000 extends migrations_1.Migration {
    async up() {
        this.addSql(`ALTER TABLE "checkout_link" ADD COLUMN IF NOT EXISTS "customer_id" TEXT;`);
    }
    async down() {
        this.addSql(`ALTER TABLE "checkout_link" DROP COLUMN IF EXISTS "customer_id";`);
    }
}
exports.Migration20260618010000 = Migration20260618010000;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA2MTgwMTAwMDAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9jaGVja291dC1saW5rL21pZ3JhdGlvbnMvTWlncmF0aW9uMjAyNjA2MTgwMTAwMDAudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsc0RBQWtEO0FBRWxELE1BQWEsdUJBQXdCLFNBQVEsc0JBQVM7SUFDcEQsS0FBSyxDQUFDLEVBQUU7UUFDTixJQUFJLENBQUMsTUFBTSxDQUNULDBFQUEwRSxDQUMzRSxDQUFDO0lBQ0osQ0FBQztJQUVELEtBQUssQ0FBQyxJQUFJO1FBQ1IsSUFBSSxDQUFDLE1BQU0sQ0FDVCxrRUFBa0UsQ0FDbkUsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQVpELDBEQVlDIn0=