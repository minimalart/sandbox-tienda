import { MedusaService } from '@medusajs/framework/utils';
import {
  DemoStore,
  ImportJob,
  ProductSalesMode,
  SiteSetting,
  SiteSettingRevision,
} from './models';

/** `NULL` = valor global de la instancia. */
export type SiteScopeId = string | null;

export type SiteNamespace = `extension:${string}` | `template:${string}` | 'commerce' | 'content';

const NAMESPACE_RE = /^(commerce|content|template:[a-z0-9-]+|extension:[a-z0-9-]+)$/;

class DemoStoreModuleService extends MedusaService({
  DemoStore,
  ImportJob,
  ProductSalesMode,
  SiteSetting,
  SiteSettingRevision,
}) {
  private assertNamespace(namespace: string): void {
    if (!NAMESPACE_RE.test(namespace)) {
      throw new Error(
        `Namespace de configuración inválido: "${namespace}". ` +
          `Se espera commerce, content, template:<id> o extension:<id>.`,
      );
    }
  }

  /** El filtro de una tienda concreta o del valor global. `undefined` traería ambas. */
  private scopeFilter(siteId: SiteScopeId) {
    return { site_id: siteId };
  }

  /**
   * Valor actual de un namespace para una tienda (o el global con `siteId = null`).
   *
   * NO cae al global por su cuenta: quien quiera precedencia tiene que pedir las dos
   * filas y resolver con `pickBySitePrecedence`. Mezclar las dos cosas acá es
   * exactamente el fail-open que documenta `lib/multistore/scope.ts`.
   */
  async getSiteSetting(namespace: string, siteId: SiteScopeId = null) {
    this.assertNamespace(namespace);
    const [row] = await this.listSiteSettings({ namespace, ...this.scopeFilter(siteId) });
    const [latest] = await this.listSiteSettingRevisions(
      { namespace, ...this.scopeFilter(siteId) },
      { order: { revision: 'DESC' }, take: 1 },
    );
    return {
      namespace,
      site_id: siteId,
      revision: latest?.revision ?? 0,
      value: (row?.value ?? {}) as Record<string, unknown>,
    };
  }

  /** El valor de la tienda Y el global, para resolver precedencia sin dos viajes. */
  async listSiteSettingWithGlobal(namespace: string, siteId: string) {
    this.assertNamespace(namespace);
    return this.listSiteSettings({ namespace, site_id: [siteId, null] as unknown as string });
  }

  async listSiteSettingHistory(namespace: string, siteId: SiteScopeId = null, take = 20) {
    this.assertNamespace(namespace);
    return this.listSiteSettingRevisions(
      { namespace, ...this.scopeFilter(siteId) },
      { order: { revision: 'DESC' }, take: Math.min(Math.max(take, 1), 100) },
    );
  }

  /**
   * Escribe un namespace y deja rastro.
   *
   * ORDEN DELIBERADO: primero la REVISIÓN, después el valor.
   *
   * El servicio que esto reemplaza hacía al revés —comparaba `expectedRevision`,
   * escribía el valor y recién después creaba la revisión—, y con eso dos writers
   * simultáneos con el mismo `expectedRevision` pasaban los dos el check: el que
   * perdía chocaba contra el índice único **después de haber pisado el valor**.
   *
   * Creando la revisión primero, el índice único `(site_id, namespace, revision)` es
   * el árbitro: el perdedor falla sin haber escrito nada.
   */
  async upsertSiteSetting(input: {
    namespace: string;
    value: Record<string, unknown>;
    siteId?: SiteScopeId;
    expectedRevision?: number;
    actorId?: string | null;
    note?: string | null;
  }) {
    this.assertNamespace(input.namespace);
    const siteId = input.siteId ?? null;
    const current = await this.getSiteSetting(input.namespace, siteId);

    if (input.expectedRevision !== undefined && input.expectedRevision !== current.revision) {
      throw new Error(
        `Conflicto de revisión en "${input.namespace}": esperaba ${input.expectedRevision}, actual ${current.revision}.`,
      );
    }

    const revision = current.revision + 1;

    // Si otro writer ya tomó este número, esto tira acá y el valor queda intacto.
    await this.createSiteSettingRevisions({
      site_id: siteId,
      namespace: input.namespace,
      revision,
      value: input.value,
      actor_id: input.actorId ?? null,
      note: input.note ?? null,
    });

    const [row] = await this.listSiteSettings({ namespace: input.namespace, ...this.scopeFilter(siteId) });
    if (row) await this.updateSiteSettings({ id: row.id, value: input.value });
    else await this.createSiteSettings({ site_id: siteId, namespace: input.namespace, value: input.value });

    return { namespace: input.namespace, site_id: siteId, revision, value: input.value };
  }

  /** Vuelve a un valor anterior creando una revisión nueva. Nunca borra historial. */
  async rollbackSiteSetting(input: {
    namespace: string;
    revision: number;
    siteId?: SiteScopeId;
    actorId?: string | null;
  }) {
    const siteId = input.siteId ?? null;
    const [target] = await this.listSiteSettingRevisions({
      namespace: input.namespace,
      revision: input.revision,
      ...this.scopeFilter(siteId),
    });
    if (!target) {
      throw new Error(`No existe la revisión ${input.revision} de "${input.namespace}".`);
    }
    return this.upsertSiteSetting({
      namespace: input.namespace,
      value: target.value as Record<string, unknown>,
      siteId,
      actorId: input.actorId,
      note: `Rollback a la revisión ${input.revision}`,
    });
  }

  /**
   * Copia la config global a una tienda recién creada (decisión "copy-at-creation").
   *
   * Sin esto, con fail-closed en lectura cada tienda nueva nace a oscuras y hay que
   * recorrer pantalla por pantalla antes de poder vender. Copiando, nace usable y
   * DIVERGE cuando alguien la edita — y la divergencia queda en el historial.
   */
  async seedSiteSettingsFromGlobal(siteId: string, actorId?: string | null) {
    const globals = await this.listSiteSettings({ site_id: null });
    for (const row of globals) {
      const [existing] = await this.listSiteSettings({ namespace: row.namespace, site_id: siteId });
      if (existing) continue;
      await this.upsertSiteSetting({
        namespace: row.namespace,
        value: (row.value ?? {}) as Record<string, unknown>,
        siteId,
        actorId,
        note: 'Copia inicial de la configuración global',
      });
    }
  }
}

export default DemoStoreModuleService;
