import { validateCuit } from '../../lib/cuit';
import { getArcaConfig, type ArcaConfig } from './config';
import { callGetPersona } from './constancia';
import { mapPersonaToTaxpayer } from './mapper';
import { getWsaaTicket } from './wsaa';
import {
  ArcaInvalidCuitError,
  ArcaNotFoundError,
  type ArcaCache,
  type NormalizedTaxpayer,
} from './types';

/** Fachada pública del módulo: lo único que consume la ruta store. */

const PERSONA_TTL_SECONDS = 24 * 60 * 60;
/** Cache negativo corto: evita martillar ARCA con CUITs inexistentes. */
const NOT_FOUND_TTL_SECONDS = 60 * 60;

type CachedPersona = NormalizedTaxpayer | { not_found: true };

export async function lookupTaxpayer(
  rawCuit: string,
  opts: {
    cache: ArcaCache;
    fetchImpl?: typeof globalThis.fetch;
    /**
     * La config de LA TIENDA que consulta. Sin esto se usa la de la INSTANCIA, que
     * es correcto sólo donde no hay contenedor: ver el cartel de `config.ts`. Los
     * dos call sites reales —la ruta store y la de admin— sí la pasan.
     */
    config?: ArcaConfig;
  }
): Promise<NormalizedTaxpayer> {
  const cuit = String(rawCuit ?? '').replace(/\D/g, '');
  if (!validateCuit(cuit)) throw new ArcaInvalidCuitError();

  const cfg = opts.config ?? getArcaConfig();
  /**
   * El cache de personas NO lleva el CUIT representada, a diferencia del del ticket
   * (`wsaa.ts:ticketIdentity`). La constancia de inscripción de un CUIT es un dato
   * PÚBLICO e idéntico lo pregunte quien lo pregunte, así que compartirlo entre
   * tiendas no filtra nada y ahorra viajes a un servicio de AFIP que se cae seguido.
   * Lo que sí cambia por entorno es el padrón consultado, y eso ya está en la clave.
   */
  const cacheKey = `arca:persona:${cfg.environment}:${cuit}`;
  const cached = await opts.cache.get<CachedPersona>(cacheKey);
  if (cached) {
    if ((cached as { not_found?: boolean }).not_found === true) throw new ArcaNotFoundError();
    return cached as NormalizedTaxpayer;
  }

  // Se le pasa `cfg` explícito y no `opts`: si `opts.config` viniera vacío, WSAA
  // resolvería la config de la INSTANCIA y firmaría con el certificado equivocado
  // mientras el resto de esta función usa el de la tienda.
  const ticket = await getWsaaTicket({ ...opts, config: cfg });
  let persona;
  try {
    persona = await callGetPersona({
      ticket,
      cuitRepresentada: cfg.cuitRepresentada,
      idPersona: cuit,
      padronUrl: cfg.urls.padron,
      fetchImpl: opts.fetchImpl,
    });
  } catch (error) {
    if (error instanceof ArcaNotFoundError) {
      await opts.cache.set(cacheKey, { not_found: true }, NOT_FOUND_TTL_SECONDS);
    }
    throw error;
  }

  const taxpayer = mapPersonaToTaxpayer(persona, cuit);
  await opts.cache.set(cacheKey, taxpayer, PERSONA_TTL_SECONDS);
  return taxpayer;
}
