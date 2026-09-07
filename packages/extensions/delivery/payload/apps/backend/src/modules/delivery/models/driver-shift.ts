import { model } from '@medusajs/framework/utils';

/**
 * DriverShift — franja horaria de disponibilidad de un repartidor de flota
 * propia, por día de la semana.
 *
 * Es una entidad del módulo delivery, NO un link. `driver_id` es una FK lógica
 * al Driver del mismo módulo (se valida en aplicación, no por constraint).
 *
 * Modela la grilla semanal de turnos: cada fila es una ventana
 * [start_time, end_time] en un `day_of_week` (0=domingo … 6=sábado). Un driver
 * puede tener varias filas por día (turnos partidos). La elegibilidad por
 * horario se calcula on-the-fly comparando el momento de despacho contra estas
 * franjas activas; no se persiste estado derivado.
 *
 *  - `day_of_week`: 0..6, convención JS Date.getDay() (0=domingo).
 *  - `start_time` / `end_time`: 'HH:mm' local de la sucursal. Comparación
 *    lexicográfica (mismo criterio que cutoff_time / time_of_day del motor de
 *    reglas).
 *  - `active`: permite desactivar una franja sin borrarla.
 */
export const DriverShift = model
  .define('driver_shift', {
    id: model.id({ prefix: 'dshift' }).primaryKey(),
    driver_id: model.text(),
    // 0..6 (0=domingo), convención JS Date.getDay().
    day_of_week: model.number(),
    // 'HH:mm' local de la sucursal.
    start_time: model.text(),
    end_time: model.text(),
    active: model.boolean().default(true),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ['driver_id', 'day_of_week'], where: 'deleted_at IS NULL' },
    { on: ['active'], where: 'deleted_at IS NULL' },
  ]);

export default DriverShift;
