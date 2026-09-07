import { model } from '@medusajs/framework/utils';
import { RenewalCycle } from './renewal-cycle';

/**
 * Historial de corridas concretas de un ciclo (una fila por intento de
 * ejecución). Separado del ciclo para que el agregado no pierda el rastro de
 * los reintentos.
 */
export const RenewalAttempt = model.define('renewal_attempt', {
  id: model.id({ prefix: 'ratt' }).primaryKey(),
  renewal_cycle: model.belongsTo(() => RenewalCycle, { mappedBy: 'attempts' }),
  started_at: model.dateTime(),
  finished_at: model.dateTime().nullable(),
  result: model.text().default('running'),
  error: model.text().nullable(),
  metadata: model.json().nullable(),
});

export default RenewalAttempt;
