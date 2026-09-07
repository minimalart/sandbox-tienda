import { Migration } from "@medusajs/framework/mikro-orm/migrations";

// Loyalty Engine — agrega el evento 'comment' a las reglas de earn (acumular
// puntos al comentar/reseñar). Extiende el check del enum. Idempotente.
export class Migration20260721200000Loyalty extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "loyalty_earn_rule" drop constraint if exists "loyalty_earn_rule_event_check";`);
    this.addSql(`do $$ begin alter table "loyalty_earn_rule" add constraint "loyalty_earn_rule_event_check" check ("event" in ('purchase', 'signup', 'first_purchase', 'order_delivered', 'birthday', 'referral', 'comment')); exception when duplicate_object then null; end $$;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "loyalty_earn_rule" drop constraint if exists "loyalty_earn_rule_event_check";`);
    this.addSql(`do $$ begin alter table "loyalty_earn_rule" add constraint "loyalty_earn_rule_event_check" check ("event" in ('purchase', 'signup', 'first_purchase', 'order_delivered', 'birthday', 'referral')); exception when duplicate_object then null; end $$;`);
  }

}
