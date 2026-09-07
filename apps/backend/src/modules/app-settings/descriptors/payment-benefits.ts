import { defineSettings } from './types';

/**
 * Ajustes de Beneficios de Pago.
 *
 * Namespace sin ajustes editables. La única variable que la extensión lee es
 * PRESTADA, y la regla de propiedad de esta migración es que una variable la
 * EDITA UN SOLO namespace: los demás la declaran en `envOnly` nombrando al
 * dueño. Sin eso, dos cards escriben la misma credencial y gana la última que
 * guardó — que es el bug que documenta `email-templates` con `S3_PUBLIC_URL`.
 *
 * ─── QUIÉN ES EL DUEÑO Y POR QUÉ ─────────────────────────────────────────────
 *
 * `MERCADOPAGO_ACCESS_TOKEN` es del namespace `extension:mercadopago`, que es
 * quien cobra con ella. Esta extensión no cobra nada: sólo la REUTILIZA para
 * pegarle a la API pública de MercadoPago y traerse el catálogo de medios de
 * pago y el plan de cuotas sin interés del comercio
 * (`modules/payment-benefits/providers/mercadopago-adapter.ts`,
 * `api/admin/payment-benefits/sync/[provider]/route.ts:25`). El botón
 * "Sincronizar Mercado Pago" de esta pantalla es todo lo que hace con ella.
 *
 * Y en `mercadopago` tampoco es editable: está en su propio `envOnly` con tres
 * bloqueos apilados —gate de registración en `medusa-config.ts`, contenedor
 * hermético del provider y camino sincrónico en el cobro—. O sea que el token
 * no baja a la base por ningún lado, y esta card lo dice en vez de dejar que
 * alguien lo busque.
 *
 * `isMpBenefitsSyncEnabled()` (`modules/payment-benefits/constants.ts:31-33`)
 * sigue leyendo `process.env` a propósito: el valor no vive en la base, así que
 * pasarlo por el resolver sería ceremonia sin cambio de comportamiento.
 */
export default defineSettings({
  namespace: 'extension:payment-benefits',
  title: 'Beneficios de pago',
  /** Sin ajustes editables, el scope no resuelve nada; se declara el honesto. */
  defaultScope: 'instance',
  envOnly: [
    {
      key: 'MERCADOPAGO_ACCESS_TOKEN',
      reason:
        'La posee `extension:mercadopago`, que es quien cobra con ella; acá sólo se REUTILIZA para el sync del catálogo de medios de pago y cuotas. Allá tampoco es editable: es opción de boot de los dos providers y la resuelve `getAccount`, que es síncrona y está en el camino del cobro. Se configura en el entorno, junto con el resto de las credenciales de MercadoPago.',
    },
  ],
  settings: [],
});
