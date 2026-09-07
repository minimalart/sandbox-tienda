"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260721200000Loyalty = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
// Loyalty Engine — agrega el evento 'comment' a las reglas de earn (acumular
// puntos al comentar/reseñar). Extiende el check del enum. Idempotente.
class Migration20260721200000Loyalty extends migrations_1.Migration {
    async up() {
        this.addSql(`alter table if exists "loyalty_earn_rule" drop constraint if exists "loyalty_earn_rule_event_check";`);
        this.addSql(`do $$ begin alter table "loyalty_earn_rule" add constraint "loyalty_earn_rule_event_check" check ("event" in ('purchase', 'signup', 'first_purchase', 'order_delivered', 'birthday', 'referral', 'comment')); exception when duplicate_object then null; end $$;`);
    }
    async down() {
        this.addSql(`alter table if exists "loyalty_earn_rule" drop constraint if exists "loyalty_earn_rule_event_check";`);
        this.addSql(`do $$ begin alter table "loyalty_earn_rule" add constraint "loyalty_earn_rule_event_check" check ("event" in ('purchase', 'signup', 'first_purchase', 'order_delivered', 'birthday', 'referral')); exception when duplicate_object then null; end $$;`);
    }
}
exports.Migration20260721200000Loyalty = Migration20260721200000Loyalty;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA3MjEyMDAwMDBMb3lhbHR5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvbG95YWx0eS9taWdyYXRpb25zL01pZ3JhdGlvbjIwMjYwNzIxMjAwMDAwTG95YWx0eS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5RUFBcUU7QUFFckUsNkVBQTZFO0FBQzdFLHdFQUF3RTtBQUN4RSxNQUFhLDhCQUErQixTQUFRLHNCQUFTO0lBRWxELEtBQUssQ0FBQyxFQUFFO1FBQ2YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxzR0FBc0csQ0FBQyxDQUFDO1FBQ3BILElBQUksQ0FBQyxNQUFNLENBQUMsa1FBQWtRLENBQUMsQ0FBQztJQUNsUixDQUFDO0lBRVEsS0FBSyxDQUFDLElBQUk7UUFDakIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxzR0FBc0csQ0FBQyxDQUFDO1FBQ3BILElBQUksQ0FBQyxNQUFNLENBQUMsdVBBQXVQLENBQUMsQ0FBQztJQUN2USxDQUFDO0NBRUY7QUFaRCx3RUFZQyJ9