import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import {
  getAdvisorConfig,
  readStoredAdvisorConfig,
  upsertAdvisorConfig,
  ADVISOR_CONFIG_DEFAULTS,
  type AdvisorConfig,
} from '../../../../lib/whatsapp/advisor/config';
import { invalidateAdvisorRules } from '../../../../modules/typesense/advisor';

import { siteFromRequest } from '../../../../lib/multistore/request';


/** `null` = la fila GLOBAL, el fallback de toda tienda sin config propia. */
const siteOf = async (req: MedusaRequest): Promise<string | null> => {
  const resolution = await siteFromRequest(req);
  return resolution.status === 'site' ? resolution.site.id : null;
};

/**
 * Config del asesor guiado de WhatsApp (`store_setting whatsapp_advisor_config`).
 *
 * Va como ruta admin y NO como script de `medusa exec`: en la consola de
 * DigitalOcean `medusa exec` bootea un segundo Medusa y se muere por OOM (503),
 * así que la única forma de cargar esto en producción es por la API admin.
 *
 *   GET  /admin/whatsapp-advisor/config
 *   POST /admin/whatsapp-advisor/config           { max_results, rules, … }
 *   POST /admin/whatsapp-advisor/config  { seed: true }        carga el vocabulario
 *   POST /admin/whatsapp-advisor/config  { seed: true, force: true }
 *
 * El body no necesita zod: `mergeAdvisorConfig` devuelve SIEMPRE una config
 * completa a partir de lo que venga (parcial, viejo o basura), que es el mismo
 * contrato que `ai_config` / `password_gate` en store-config.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const config = await getAdvisorConfig(req.scope, await siteOf(req));
  res.json({ config, needs_resync_from_version: config.rules.version });
};

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = (req.body ?? {}) as Record<string, unknown> & { seed?: boolean; force?: boolean };

  if (body.seed === true) {
    const current = await getAdvisorConfig(req.scope, await siteOf(req));
    const incoming = ADVISOR_CONFIG_DEFAULTS.rules.version;
    // La guarda tiene que mirar la fila CRUDA, no la config mergeada:
    // `getAdvisorConfig` cae a los defaults cuando no hay nada guardado, así que
    // comparar su `version` daba siempre `1 >= 1` y el PRIMER seed nunca pasaba
    // (había que mandar `force`). Lo que decide es si existe la fila.
    const stored = await readStoredAdvisorConfig(req.scope, await siteOf(req));
    const alreadySeeded = stored !== null;
    // Idempotente y no destructivo: no pisa ajustes hechos a mano salvo `force`.
    if (body.force !== true && alreadySeeded && current.rules.version >= incoming) {
      res.json({
        config: current,
        seeded: false,
        reason: `ya hay reglas versión ${current.rules.version} (>= ${incoming}); mandá force:true para sobreescribir`,
      });
      return;
    }
    const saved = await upsertAdvisorConfig(req.scope, ADVISOR_CONFIG_DEFAULTS);
    invalidateAdvisorRules();
    res.json({ config: saved, seeded: true, resync_required: true });
    return;
  }

  const saved = await upsertAdvisorConfig(req.scope, body as Partial<AdvisorConfig>);
  // La caché de reglas del indexado vive 30 s en el proceso; invalidarla acá hace
  // que el próximo reindex use lo recién guardado sin esperar.
  invalidateAdvisorRules();
  res.json({ config: saved, resync_required: true });
};
