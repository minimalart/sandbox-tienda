import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils';
import {
  countSiteCredentialsByIntegrationViaSql,
  deleteSiteCredentialsViaSql,
  listSiteCredentialsViaSql,
  readSiteCredentialsViaSql,
  writeSiteCredentialsViaSql,
  type SiteCredentialSummary,
} from '../../../lib/multistore/credentials';
import { siteFromRequest } from '../../../lib/multistore/request';
import type { SiteResolution } from '../../../lib/multistore/types';
import { ensureDemoStoreTables } from '../../../modules/demo-store/ensure-tables';
import {
  CREDENTIAL_CATALOG,
  findIntegration,
  hasEnvCredentials,
  type CredentialKeySpec,
  type IntegrationSpec,
} from './catalog';
import { DeleteSiteCredentialSchema, type UpsertSiteCredentialInput } from './schemas';

/**
 * Credenciales de terceros POR TIENDA — la contraparte de escritura de
 * `lib/multistore/credentials.ts`.
 *
 * La tabla `site_credential` nació con cinco lectores y CERO escritores: hasta acá,
 * dar de alta la cuenta de Andreani de una tienda era un INSERT a mano con el blob
 * de `encryptCredentials`. Y sin esta pantalla no se puede prender fail-closed en
 * ninguna extensión, porque no habría cómo configurarla por tienda.
 *
 * Dos invariantes que no se negocian:
 *
 *  1. **Ningún valor sale de acá.** Ni cifrado, ni parcial, ni "sólo los no
 *     secretos". Lo que se devuelve son NOMBRES de claves y flags. Un secreto que
 *     el backoffice puede mostrar es un secreto que termina en un log, en una
 *     captura de pantalla o en la caché del browser.
 *  2. **Sin tienda resuelta no se escribe.** Un POST sin `x-site-id` no cae a la
 *     credencial global: es un 400. El default silencioso es el bug que convierte
 *     "cargué la cuenta de la tienda Norte" en "le cambié la cuenta a todas".
 */

/** Marcador para preguntarle al lector si hay fallback de entorno, sin valores. */
const ENV_SENTINEL = { __env: 'set' } as const;

type PgLike = { raw: (sql: string, bindings?: unknown[]) => Promise<{ rows?: any[] }> };

const pgOf = (req: MedusaRequest): PgLike | undefined => {
  try {
    return req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as unknown as PgLike;
  } catch {
    return undefined;
  }
};

type IntegrationStatus = {
  integration: string;
  label: string;
  keys: CredentialKeySpec[];
  /** ¿Esta tienda tiene fila propia? Es `true` incluso si el blob no se puede leer. */
  is_set: boolean;
  /** Los NOMBRES de las claves definidas. Nunca los valores. */
  set_keys: string[];
  /** `false` = hay fila pero el blob no descifra. Para los providers eso CORTA. */
  decryptable: boolean;
  /**
   * De dónde salen las credenciales que se van a usar de verdad.
   * `none` incluye el caso ilegible: ahí el provider tira en vez de degradar.
   */
  effective_source: 'site' | 'env' | 'none';
  env_available: boolean;
  updated_at: string | null;
  /** Archivo que consume estas credenciales, o `null` si todavía no hay lector. */
  reader: string | null;
  blocked_reason: string | null;
  /** `false` = guardar no tendría efecto; el POST la rechaza. */
  writable: boolean;
};

const baseStatus = (spec: IntegrationSpec): IntegrationStatus => ({
  integration: spec.integration,
  label: spec.label,
  keys: spec.keys,
  is_set: false,
  set_keys: [],
  decryptable: true,
  effective_source: 'none',
  env_available: hasEnvCredentials(spec),
  updated_at: null,
  reader: spec.reader,
  blocked_reason: spec.blockedReason ?? null,
  writable: Boolean(spec.reader),
});

/**
 * El estado de una integración para la tienda de la request.
 *
 * `effective_source` NO se deduce de la fila: se pregunta con el mismo
 * `readSiteCredentialsViaSql` que usan los providers. Deducirlo acá sería una
 * segunda implementación de la misma regla, y el día que una de las dos cambie el
 * admin mostraría "usa las de la tienda" mientras el carrier despacha con las del
 * entorno. Son cinco lookups puntuales por índice en una pantalla de configuración.
 */
async function statusFor(
  pg: PgLike | undefined,
  spec: IntegrationSpec,
  resolution: SiteResolution,
  row: SiteCredentialSummary | undefined
): Promise<IntegrationStatus> {
  const status = baseStatus(spec);
  status.is_set = Boolean(row);
  status.set_keys = row?.keys ?? [];
  status.decryptable = row?.decryptable ?? true;
  status.updated_at = row?.updated_at ?? null;

  const effective = await readSiteCredentialsViaSql(pg, spec.integration, resolution, () =>
    status.env_available ? { ...ENV_SENTINEL } : null
  );

  if (effective.status === 'found') {
    status.effective_source = effective.source;
  } else {
    // `undecryptable` no es "no hay": es "hay y no se puede usar". El provider
    // levanta una excepción antes que despachar con la cuenta de otro titular.
    status.effective_source = 'none';
    if (effective.reason === 'undecryptable') status.decryptable = false;
  }

  return status;
}

/**
 * GET /admin/site-credentials — qué integraciones tienen credencial propia en la
 * tienda activa. Devuelve nombres de claves y flags; NUNCA un valor.
 *
 * Sin tienda activa (`x-site-id: *` o sin header) no se puede mostrar la de nadie,
 * así que devuelve el mapa del catálogo con el estado de ENTORNO y, por integración,
 * en cuántas tiendas hay algo cargado. Eso es lo único honesto que se puede decir
 * desde "todas las tiendas", y es justo el dato que hace falta para planificar el
 * fail-closed.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const pg = pgOf(req);
  const resolution = await siteFromRequest(req);

  if (resolution.status !== 'site') {
    const counts = await countSiteCredentialsByIntegrationViaSql(pg);
    res.status(200).json({
      site: null,
      scope: resolution.status,
      message:
        'Elegí una tienda para ver o editar sus credenciales. Sin tienda activa sólo se ' +
        'informa el estado del entorno y cuántas tiendas tienen credencial propia.',
      integrations: CREDENTIAL_CATALOG.map((spec) => ({
        ...baseStatus(spec),
        effective_source: hasEnvCredentials(spec) ? ('env' as const) : ('none' as const),
        sites_with_credentials: counts[spec.integration] ?? 0,
      })),
    });
    return;
  }

  const rows = await listSiteCredentialsViaSql(pg, resolution.site.id);
  const byIntegration = new Map(rows.map((row) => [row.integration, row]));

  const integrations = await Promise.all(
    CREDENTIAL_CATALOG.map((spec) =>
      statusFor(pg, spec, resolution, byIntegration.get(spec.integration))
    )
  );

  // Filas de integraciones que el catálogo no conoce (cargadas a mano, o de una
  // extensión que se desinstaló). Se muestran para que se puedan limpiar: una fila
  // invisible con un secreto adentro es peor que una fila fea.
  const known = new Set(CREDENTIAL_CATALOG.map((spec) => spec.integration));
  const unknown = rows
    .filter((row) => !known.has(row.integration))
    .map((row) => ({
      integration: row.integration,
      set_keys: row.keys,
      decryptable: row.decryptable,
      updated_at: row.updated_at,
    }));

  res.status(200).json({
    site: { id: resolution.site.id, slug: resolution.site.slug, name: resolution.site.name },
    scope: 'site',
    integrations,
    unknown_integrations: unknown,
  });
}

/** La tienda de la request, o 400. Sin tienda NO se escribe una credencial de tienda. */
async function requireSite(
  req: MedusaRequest
): Promise<{ id: string; resolution: SiteResolution }> {
  const resolution = await siteFromRequest(req);
  if (resolution.status !== 'site') {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'No hay tienda activa. Una credencial de tienda se guarda contra UNA tienda: ' +
        'mandá el header x-site-id. Caer a la configuración global sin que nadie lo pida ' +
        'le cambiaría la cuenta a todas las tiendas de la instancia.'
    );
  }
  return { id: resolution.site.id, resolution };
}

/**
 * POST /admin/site-credentials — upsert de `(site_id, integration)`.
 *
 * MERGEA sobre lo guardado. Es la lección de `modules/erp/service.ts:255-259`: ahí
 * un guardado con una sola credencial pisaba el blob entero, así que rotar el
 * `apiKey` borraba en silencio el `baseUrl` y el provider quedaba a medio
 * configurar sin un solo error.
 *
 * Un valor vacío se IGNORA: significa "no toqué el campo enmascarado". Para borrar
 * está `unset`, por nombre de clave — que es lo único que la UI conoce de un secreto
 * write-only.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const input = req.validatedBody as UpsertSiteCredentialInput;
  const { id: siteId, resolution } = await requireSite(req);

  const spec = findIntegration(input.integration);
  if (!spec) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Integración desconocida: ${input.integration}.`
    );
  }
  if (!spec.reader) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      spec.blockedReason ?? 'Esta integración no admite credenciales por tienda.'
    );
  }

  await ensureDemoStoreTables(req.scope);
  const pg = pgOf(req);
  if (!pg) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, 'Sin conexión a la base de datos.');
  }

  const result = await writeSiteCredentialsViaSql(
    pg,
    spec.integration,
    siteId,
    { set: input.set, unset: input.unset },
    { onUndecryptable: input.replace_undecryptable ? 'replace' : 'fail' }
  );

  if (result.status === 'undecryptable') {
    // 409 y no 500: el estado del recurso es el problema, y hay una salida. Se
    // corta en vez de mergear sobre `{}` porque eso perdería en silencio las claves
    // que el operador cree guardadas — irrecuperables, pero él no lo sabe.
    throw new MedusaError(
      MedusaError.Types.CONFLICT,
      `Las credenciales guardadas de '${spec.integration}' en esta tienda no se pueden ` +
        `descifrar (típicamente porque rotó JWT_SECRET). No se pueden mergear: lo que había ` +
        `es irrecuperable. Reenviá con replace_undecryptable: true para reemplazarlas por ` +
        `completo, cargando de nuevo TODAS las claves de la integración.`
    );
  }

  const rows = await listSiteCredentialsViaSql(pg, siteId);
  const status = await statusFor(
    pg,
    spec,
    resolution,
    rows.find((row) => row.integration === spec.integration)
  );

  res.status(200).json({
    result: result.status,
    written: result.status === 'saved' ? result.written : [],
    removed: result.status === 'saved' || result.status === 'cleared' ? result.removed : [],
    integration: status,
  });
}

/**
 * DELETE /admin/site-credentials?integration=… — desconecta la cuenta propia de la
 * tienda; vuelve a heredar las del entorno.
 *
 * Distinto de `unset`, que quita claves sueltas. Va con query param y no en el body
 * porque un DELETE con body no sobrevive a todos los clientes HTTP.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { id: siteId, resolution } = await requireSite(req);

  const raw = req.query?.integration;
  const parsed = DeleteSiteCredentialSchema.safeParse({
    integration: typeof raw === 'string' ? raw.trim() : undefined,
  });
  if (!parsed.success) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `Falta el query param 'integration'.`);
  }
  const integration = parsed.data.integration;

  const pg = pgOf(req);
  if (!pg) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, 'Sin conexión a la base de datos.');
  }

  /**
   * `spec` puede ser `undefined`, y ese es el caso que importa.
   *
   * Se permite borrar integraciones que el catálogo NO conoce —filas cargadas con
   * un INSERT a mano, o de una integración que después se renombró— porque son
   * exactamente las que hay que poder limpiar y no hay otra vía. Antes acá había
   * un `findIntegration(...)!`: el non-null assertion mentía, así que una
   * desconocida pasaba la validación y reventaba con un TypeError al leer
   * `spec.integration`.
   *
   * El borrado nunca necesitó el catálogo: es por `(site_id, integration)` y sólo
   * alcanza filas de la tienda de la request. Lo único que se pierde sin `spec`
   * es poder devolver el estado enriquecido, así que se devuelve el mínimo.
   */
  const spec = findIntegration(integration);
  const deleted = await deleteSiteCredentialsViaSql(pg, integration, siteId);

  if (!spec) {
    res.status(200).json({
      result: deleted ? 'deleted' : 'not_found',
      integration: { integration, known: false, is_set: false, set_keys: [] },
    });
    return;
  }

  const status = await statusFor(pg, spec, resolution, undefined);
  res.status(200).json({ result: deleted ? 'deleted' : 'not_found', integration: status });
}
