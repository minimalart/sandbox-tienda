import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { MedusaError } from '@medusajs/framework/utils';
import { z } from 'zod';
import { siteFromRequest } from '../../../lib/multistore/request';
import { UNKNOWN_SITE_ERROR_CODE } from '../../../lib/multistore/types';
import type { SiteResolution } from '../../../lib/multistore/types';
import {
  PROCESS_STARTED_AT,
  applyPlan,
  getStates,
  siteScopeIdOf,
} from '../../../modules/app-settings/service';
import { allDescriptors, findNamespace } from '../../../modules/app-settings/descriptors';
import { buildWritePlan } from '../../../modules/app-settings/write-plan';

/**
 * Ajustes de aplicación por namespace, POR TIENDA.
 *
 * La tienda sale de `siteFromRequest` —el header `x-site-id` que cuelga el
 * middleware de `/admin/*`— y viaja hasta el resolver, que aplica la precedencia
 * de la decisión 3: la principal hereda de la global, una secundaria que no
 * configuró lo suyo queda en `'off'`, y los descriptores `scope: 'instance'`
 * siempre leen y escriben la fila global.
 *
 * LO QUE SE LEE ES LO QUE SE ESCRIBE, y eso no es casualidad: `siteScopeIdOf` es
 * la contraparte de `siteKindOf` y las dos coinciden en las cinco variantes de
 * `SiteResolution`. Si divergieran, la card mostraría el valor de una capa y
 * guardaría en otra — el clásico "guardo y no pasa nada".
 *
 * La respuesta lleva ESTADO, nunca descriptores: el bundle del admin importa
 * `modules/app-settings/descriptors` directo, así que labels, tipos y opciones
 * ya los tiene estáticos y mandarlos por la red sería duplicarlos.
 *
 * El namespace nunca es segmento de path — `extension:typesense` tiene dos
 * puntos — así que va como query param en GET y como campo del body en POST.
 *
 * La validación es `.parse()` inline y no `validateAndTransformBody`, siguiendo
 * a `api/admin/store-config/settings/route.ts`. La validación que importa (por
 * descriptor) vive igual en `buildWritePlan`, que es puro y testeado.
 */

const descriptorsFor = (namespace?: string) => {
  if (!namespace) return allDescriptors;
  return findNamespace(namespace)?.settings ?? null;
};

/**
 * Un id de tienda stale rompe, no degrada.
 *
 * Es el mismo criterio y el mismo código que `lib/multistore/scope.ts:86`, y el
 * admin lo usa para limpiar la tienda que tiene persistida y volver a elegir.
 * `siteKindOf` igual fail-cierra un `unknownSite` como si fuera secundaria, pero
 * esa es la segunda línea: acá se ve el error en vez de una card entera en gris
 * sin explicación.
 */
const unknownSite = (resolution: SiteResolution): boolean =>
  resolution.status === 'unknownSite';

const UNKNOWN_SITE_BODY = {
  code: UNKNOWN_SITE_ERROR_CODE,
  message: 'La tienda seleccionada no existe o fue eliminada. Elegí otra y volvé a intentar.',
};

/** GET /admin/app-settings[?namespace=extension:typesense] */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const namespace = typeof req.query.namespace === 'string' ? req.query.namespace : undefined;
    const descriptors = descriptorsFor(namespace);

    // Un namespace inexistente es un error del cliente, no una lista vacía: una
    // card con el namespace mal tipeado tiene que gritar, no renderizar vacía.
    if (descriptors === null) {
      return res.status(404).json({ message: `No hay ajustes declarados para "${namespace}".` });
    }

    const resolution = await siteFromRequest(req);
    if (unknownSite(resolution)) return res.status(400).json(UNKNOWN_SITE_BODY);

    const settings = await getStates(req.scope, descriptors, resolution);

    return res.status(200).json({
      settings,
      // La capa que esta pantalla está viendo Y editando. `null` = la global de
      // la instancia. Sin esto, la card de una tienda y la de "todas" se ven
      // idénticas y el operador no sabe qué está por pisar.
      site_id: siteScopeIdOf(resolution),
      // NO hay `boot_stale`: todo ajuste gestionable desde acá aplica al instante.
      // El campo existía para el tier `'boot'`, que prometía un reinicio que no
      // cambiaba nada porque `medusa-config.ts` no lee la base.
      process_started_at: PROCESS_STARTED_AT.toISOString(),
    });
  } catch (error) {
    console.error('[Admin AppSettings] Error leyendo ajustes:', error);
    return res.status(500).json({ message: 'Error leyendo los ajustes' });
  }
}

const UpdateSchema = z.object({
  namespace: z.string().min(1),
  /** PATCH: lo que no venga acá no se toca. */
  values: z.record(z.string(), z.unknown()).optional(),
  /** Borrado explícito por nombre. Nunca se infiere de un valor vacío. */
  unset: z.array(z.string()).optional(),
});

/** POST /admin/app-settings */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  let namespace = '';
  try {
    const body = UpdateSchema.parse(req.body);
    namespace = body.namespace;

    const descriptors = descriptorsFor(namespace);
    if (descriptors === null) {
      return res.status(404).json({ message: `No hay ajustes declarados para "${namespace}".` });
    }

    const resolution = await siteFromRequest(req);
    if (unknownSite(resolution)) return res.status(400).json(UNKNOWN_SITE_BODY);

    const plan = buildWritePlan({ descriptors, values: body.values, unset: body.unset });
    if (!plan.ok) {
      // Todo o nada: no se escribió nada. Una card guardada a medias deja al
      // operador sin saber qué quedó aplicado.
      return res.status(400).json({ message: 'Hay ajustes inválidos.', errors: plan.errors });
    }

    const actorId = (req as { auth_context?: { actor_id?: string } }).auth_context?.actor_id ?? null;

    const applied = await applyPlan(req.scope, {
      namespace,
      descriptors,
      plan,
      actorId,
      resolution,
    });

    const settings = await getStates(req.scope, descriptors, resolution);

    return res.status(200).json({
      settings,
      site_id: siteScopeIdOf(resolution),
      // Sin `restart_required`: lo que se acaba de guardar ya está aplicado. El
      // campo existía para el tier `'boot'` y prometía un reinicio inútil.
      process_started_at: PROCESS_STARTED_AT.toISOString(),
      // `true` la primera vez que una tienda forkea un namespace: su fila se crea
      // copiando la global. Es información que el operador quiere ver — a partir
      // de acá esa tienda deja de seguir a la instancia.
      seeded_from_global: applied.scopes.some((s) => s.seeded_from_global),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Body inválido.' });
    }
    // El 409 de carrera lo produce `applyPlanForSite` con un mensaje pensado para
    // el operador ("recargá y volvé a aplicar"): pasarlo tal cual vale más que un
    // 500 genérico, que enseña a apretar guardar de nuevo hasta que salga.
    if (isMedusaErrorOfType(error, MedusaError.Types.CONFLICT)) {
      return res.status(409).json({ message: error.message });
    }
    // Sin el módulo de tiendas no hay dónde escribir: `requireSiteSettingsStore`
    // corta con un mensaje que explica exactamente eso. Un 500 lo escondería
    // detrás de "algo salió mal", que es el peor cartel posible para una falla de
    // configuración del proyecto.
    if (isMedusaErrorOfType(error, MedusaError.Types.NOT_ALLOWED)) {
      return res.status(409).json({ message: error.message });
    }
    if (isMedusaErrorOfType(error, MedusaError.Types.INVALID_DATA)) {
      return res.status(400).json({ message: error.message });
    }
    console.error(`[Admin AppSettings] Error guardando ${namespace}:`, error);
    return res.status(500).json({ message: 'Error guardando los ajustes' });
  }
}

function isMedusaErrorOfType(error: unknown, type: string): error is { message: string } {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as { type?: unknown; message?: unknown };
  return e.type === type && typeof e.message === 'string';
}
