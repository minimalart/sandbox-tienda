import { model } from '@medusajs/framework/utils';
import { EarnRule } from './earn-rule';
import { Reward } from './reward';
import { Tier } from './tier';
import { Campaign } from './campaign';

// A loyalty program groups the earn rules, rewards, tiers and campaigns of the
// Loyalty Engine. The MVP runs a single active program; the model supports more
// so multi-program setups don't need a disruptive migration later.
//
// `expiration_policy` (JSON): { type: 'none' | 'fixed_days' | 'end_of_year', days?: number }.
// The points ledger itself lives in the `points` module (extension loyalty-points);
// this program only configures how points are earned/spent.
export const LoyaltyProgram = model.define('loyalty_program', {
  id: model.id({ prefix: 'loypr' }).primaryKey(),
  name: model.text(),
  status: model.enum(['active', 'inactive']).default('active'),
  points_name: model.text().default('puntos'),
  currency_code: model.text().default('ars'),
  starts_at: model.dateTime().nullable(),
  ends_at: model.dateTime().nullable(),
  expiration_policy: model.json().nullable(),
  config: model.json().nullable(),
  earn_rules: model.hasMany(() => EarnRule, { mappedBy: 'program' }),
  rewards: model.hasMany(() => Reward, { mappedBy: 'program' }),
  tiers: model.hasMany(() => Tier, { mappedBy: 'program' }),
  campaigns: model.hasMany(() => Campaign, { mappedBy: 'program' }),
  /**
   * La tienda dueña del programa. `NULL` = global de la instancia.
   *
   * El eje va SÓLO acá: tiers, rewards, campaigns y earn-rules cuelgan del programa
   * y heredan su tienda por la FK. Repetir `site_id` en las cinco tablas parece más
   * simple hasta que una escritura se lo olvida — la fila queda contradiciendo a su
   * propio programa y no hay forma de detectarlo salvo mirando datos.
   *
   * Los programas existentes quedan en `NULL` y se siguen viendo desde cualquier
   * tienda: esconder el programa de fidelidad vivo el día del deploy sería apagarlo
   * sin avisar a nadie.
   */
  site_id: model.text().nullable(),
});
