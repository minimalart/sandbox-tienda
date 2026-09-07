import { defineSettings } from './types';

/**
 * Ajustes del motor de fidelización.
 *
 * El manifest declara `environment: []` y el código lee dos variables. Una baja
 * a la base y la otra no puede, y el motivo de la segunda vale para toda la
 * migración.
 *
 * ─── POR QUÉ `LOYALTY_EXPIRE_SCHEDULE` NO PUEDE SER UN DESCRIPTOR ────────────
 *
 * Se usa como `schedule:` del job (`jobs/expire-loyalty-points.ts:11`), o sea
 * en el objeto `config` que se evalúa cuando Medusa CARGA el archivo del job,
 * al arrancar. En ese momento no hay contenedor, no hay conexión a Postgres y
 * el snapshot de `app-settings` todavía no se llenó: una fila en `site_setting`
 * no llegaría a tiempo ni siquiera reiniciando, porque el loader del módulo
 * corre después. El scheduler se queda con el cron que leyó y no lo vuelve a
 * mirar.
 *
 * La regla general, que se repite en `dynamic-groups`: lo que define CUÁNDO
 * corre un job es `envOnly`; lo que se evalúa DENTRO del cuerpo del job (kill
 * switches, ventanas, límites) sí puede ser descriptor, porque para entonces ya
 * hay contenedor.
 *
 * ─── LO QUE NO ESTÁ ACÁ ──────────────────────────────────────────────────────
 *
 * El grueso de la fidelización NO es configuración de entorno: programa, reglas
 * de acumulación, niveles, vencimientos y recompensas viven en tablas propias
 * del módulo (`loyalty_program`, `earn_rule`, …) y se editan en Fidelización →
 * Configuración. Acá hay una sola variable, y es la del sistema VIEJO.
 */
export default defineSettings({
  namespace: 'extension:loyalty-engine',
  title: 'Fidelización',
  /** The synchronous legacy fallback is shared; programs keep per-store rules. */
  defaultScope: 'instance',
  envOnly: [
    {
      key: 'LOYALTY_EXPIRE_SCHEDULE',
      reason:
        'Es el `schedule:` del job de vencimiento (`jobs/expire-loyalty-points.ts:11`, default `0 3 * * *`). Medusa lo lee al CARGAR el archivo, antes de que exista el contenedor y la conexión a la base, y el scheduler no lo vuelve a consultar: una fila en `site_setting` no llegaría a tiempo ni reiniciando. Cambiarlo es cambiar el entorno y reiniciar.',
    },
  ],
  settings: [
    {
      key: 'POINTS_EARN_RATE',
      env: ['POINTS_EARN_RATE'],
      type: 'number',
      tier: 'runtime',
      group: 'Acumulación',
      label: 'Tasa de acumulación legacy',
      // Una oración. El gotcha caro —apenas hay un programa activo este número deja de
      // mirarse, se guarda igual y no pasa nada— estaba dicho DOS veces con palabras
      // distintas (acá y en el encabezado del descriptor) y ahora es la sección "La
      // tasa legacy y el programa no conviven" del drawer.
      help: 'Puntos por unidad de moneda, y sólo se usa mientras no haya un programa activo del motor nuevo.',
      /**
       * `max: 10` no es un número redondo elegido al azar: 1 ya significa "un
       * punto por cada peso", que es la relación más generosa que se usa en la
       * práctica. El rango existe por el error de tipeo — un `10` donde iba
       * `0.10` multiplica la acumulación por cien, los puntos son canjeables, y
       * el regalo se descubre cuando los clientes ya los gastaron. Un tope acá
       * cuesta nada; el `min: 0` evita el otro absurdo, restar puntos al comprar.
       */
      min: 0,
      max: 10,
      step: 0.01,
      default: 1,
    },
  ],
});
