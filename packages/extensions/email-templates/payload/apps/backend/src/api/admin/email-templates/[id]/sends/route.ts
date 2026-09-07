import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import type { INotificationModuleService } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';
import { EMAIL_TEMPLATE_MODULE } from '../../../../../modules/email-template';
import type EmailTemplateModuleService from '../../../../../modules/email-template/service';
import { variablesForKey } from '../../../../../modules/email/template-variables';
import {
  GetAdminEmailTemplateSends,
  analyzeSend,
  siteAttribution,
  type DeclaredVariable,
  type SendAnalysis,
} from '../../sends-analysis';

import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { EMAIL_TEMPLATE_SITE_SCOPE } from '../../../../../modules/email-template/site-scope';

/**
 * GET /admin/email-templates/:id/sends — los ÚLTIMOS ENVÍOS REALES de la plantilla,
 * con el valor que tuvo cada variable en el mail que salió.
 *
 * Es la contraparte de `preview`/`test-send`, que renderizan con `sample_data`: esos
 * valores son de DEMO y los escribe el operador a mano. Acá no hay nada renderizado
 * ni inventado — `notification.data` guarda el payload EXACTO con el que el
 * proveedor armó el mail. Esa distinción es el motivo de la ruta: sin ella, una
 * variable que ningún emisor poblaba (`sales_channel_name` en `password-reset`)
 * podía romper el asunto durante semanas sin dejar rastro ni en el log ni en la UI.
 *
 * `template` y `channel` son COLUMNAS escalares de `notification` —verificado
 * contra el esquema real y contra `FilterableNotificationProps` de @medusajs/types
 * 2.18.0—, así que el filtro del módulo se compila a un `WHERE` común y no hay que
 * traer una ventana y filtrar a mano. Igual se re-filtra en memoria abajo; la nota
 * está ahí.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  /**
   * MISMO guard que `preview` y `test-send`, y acá pesa más que en las dos: lo que
   * devuelve esta ruta es el mail de un CLIENTE, con su dirección y sus datos de
   * pedido. Sin esto, el id de una plantilla ajena entrega la correspondencia de
   * otra tienda.
   *
   * Va AFUERA del `try` a propósito, como en `preview`: adentro, el `catch`
   * convertiría el 404 del guard en un 400 con el mensaje, y el status es parte de
   * lo que evita filtrar la existencia de la fila.
   */
  const resolution = await siteFromRequest(req);
  await assertIdInSite(
    req.scope,
    resolution,
    EMAIL_TEMPLATE_SITE_SCOPE,
    req.params.id as string,
  );

  let limit: number;
  try {
    ({ limit } = GetAdminEmailTemplateSends.parse(req.query ?? {}));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid query';
    return res.status(400).json({ message });
  }

  try {
    const service: EmailTemplateModuleService = req.scope.resolve(
      EMAIL_TEMPLATE_MODULE,
    );
    const notificationService: INotificationModuleService = req.scope.resolve(
      Modules.NOTIFICATION,
    );

    const stored = await service.retrieveEmailTemplate(req.params.id as string);
    const key = stored.key as string;

    /**
     * MISMO criterio que la pantalla del admin (`routes/email-templates/[id]/page.tsx`):
     * gana lo que declara la FILA y, si no declara nada, el catálogo del código.
     *
     * No es una comodidad: TODA plantilla creada fuera del seed nace con `variables`
     * en `null`, y sin el fallback esta pantalla mostraría "0 variables declaradas" y
     * volcaría las siete reales a la lista de "no declaradas". O sea que la fila
     * incompleta volvería a esconder el diagnóstico, que es el bug original una
     * capa más arriba.
     */
    const declaredOnRow = (stored.variables ?? []) as DeclaredVariable[];
    const declared =
      declaredOnRow.length > 0
        ? declaredOnRow
        : (variablesForKey(key) as DeclaredVariable[]);

    /**
     * `channel: 'email'` no es redundante con la key: `order-confirmation` tiene 8
     * envíos por `email` y 8 por `whatsapp` en desdeelsur, con payloads distintos.
     * Mezclarlos haría que la pantalla de la plantilla de MAIL acuse variables
     * faltantes que en realidad son de otro canal.
     *
     * Los envíos de PRUEBA del admin quedan afuera solos, y está bien: salen con
     * `template: '__inline__'` (asunto y HTML ya renderizados), así que nunca
     * matchean la key. Incluirlos sería contradictorio — son la vista previa con
     * `sample_data`, o sea justo los valores de demo que esta pantalla vino a
     * distinguir de los reales.
     */
    const notifications = await notificationService.listNotifications(
      { template: key, channel: 'email' },
      { take: limit, order: { created_at: 'DESC' } },
    );

    /**
     * Re-filtro en memoria sobre lo que ya volvió filtrado. Cuesta un `filter` sobre
     * como máximo 50 filas y cubre el modo de falla que no da error: si algún día el
     * módulo dejara de traducir uno de los dos filtros, el resultado no sería un 500
     * sino esta pantalla mostrando los mails de OTRA plantilla como si fueran de
     * esta. Un fail-open silencioso es exactamente el género de bug que esta ruta
     * vino a hacer visible; no lo vamos a reintroducir en la ruta misma.
     */
    const rows = notifications.filter(
      (n) => n.template === key && n.channel === 'email',
    );

    /**
     * Segundo eje de aislamiento: la NOTIFICACIÓN no tiene columna de tienda.
     *
     * El guard de arriba dice que esta FILA se puede mirar desde la tienda activa,
     * pero el descriptor es `empty: 'all'`: la plantilla GLOBAL se ve desde todas.
     * O sea que sin este paso, la tienda A abre la `password-reset` global y lee los
     * mails de los clientes de la B.
     *
     * `unknown` (el payload no trae ningún marcador) se OCULTA pero se CUENTA, y el
     * contador viaja al cliente. Ocultar sin contar dejaría una tabla vacía que se
     * lee como "no hubo envíos" — la mentira por omisión que esta feature ataca.
     * Contar sin ocultar filtraría datos de otra tienda. Con el contador, la UI dice
     * "hay N que no se pueden atribuir" y el operador sabe que falta algo.
     *
     * Con `singleSite`/`allSites`/`registryAbsent` no se oculta nada: no hay otra
     * tienda de la cual aislar. Es el caso de desdeelsur, que tiene una sola.
     */
    let unattributed = 0;
    const visible =
      resolution.status === 'site'
        ? rows.filter((n) => {
            const verdict = siteAttribution(
              n.data as Record<string, unknown> | null,
              resolution.site,
            );
            if (verdict === 'unknown') unattributed += 1;
            return verdict === 'yes';
          })
        : rows;

    const sends: SendAnalysis[] = visible.map((n) =>
      analyzeSend(
        {
          id: n.id,
          to: n.to,
          created_at: n.created_at,
          status: n.status,
          provider_id: n.provider_id,
          data: (n.data as Record<string, unknown> | null) ?? null,
        },
        declared,
      ),
    );

    return res.status(200).json({
      sends,
      count: sends.length,
      limit,
      /** Las variables que la plantilla DICE tener, para que la UI sepa el universo. */
      declared,
      /** Envíos escondidos porque su payload no permite atribuirlos a esta tienda. */
      unattributed,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error listing template sends';
    console.error('[Admin EmailTemplates] Error listing sends:', message);
    return res.status(400).json({ message });
  }
}
