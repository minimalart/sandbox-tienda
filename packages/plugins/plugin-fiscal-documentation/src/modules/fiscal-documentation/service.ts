import { MedusaService, MedusaError } from '@medusajs/framework/utils';
import { FiscalDocument } from './models';
import { diffSnapshots } from './snapshot';
import type {
  FiscalDiffEntry,
  FiscalDocumentRecord,
  FiscalDocumentSource,
  FiscalOwnerType,
  FiscalSnapshot,
} from './types';

type CreateDocumentInput = {
  owner_type: FiscalOwnerType;
  owner_id: string;
  tax_id: string;
  snapshot: FiscalSnapshot;
  snapshot_hash: string;
  source?: FiscalDocumentSource;
  file_id?: string | null;
  file_url?: string | null;
  requested_by?: string | null;
  generated_at?: Date | null;
  metadata?: Record<string, unknown> | null;
};

function first<T>(res: T | T[]): T {
  return (Array.isArray(res) ? res[0] : res) as T;
}

class FiscalDocumentationModuleService extends MedusaService({ FiscalDocument }) {
  /** Documentos de un owner, más nuevo primero. */
  async listByOwner(
    ownerType: FiscalOwnerType,
    ownerId: string,
  ): Promise<FiscalDocumentRecord[]> {
    const rows = await this.listFiscalDocuments(
      { owner_type: ownerType, owner_id: ownerId },
      { order: { created_at: 'DESC' } },
    );
    return rows as unknown as FiscalDocumentRecord[];
  }

  /** La constancia vigente del owner (o null). */
  async getCurrent(
    ownerType: FiscalOwnerType,
    ownerId: string,
  ): Promise<FiscalDocumentRecord | null> {
    const rows = await this.listFiscalDocuments(
      { owner_type: ownerType, owner_id: ownerId, status: 'vigente' },
      { order: { created_at: 'DESC' } },
    );
    return (rows[0] as unknown as FiscalDocumentRecord) ?? null;
  }

  /**
   * Crea una versión nueva y la marca `vigente`, archivando la anterior como
   * `historica`. Nunca reemplaza documentos: el historial es append-only.
   * Devuelve el documento nuevo, la versión anterior (si había) y el diff.
   */
  async createVersion(input: CreateDocumentInput): Promise<{
    document: FiscalDocumentRecord;
    previous: FiscalDocumentRecord | null;
    diff: FiscalDiffEntry[];
    changed: boolean;
  }> {
    const previous = await this.getCurrent(input.owner_type, input.owner_id);

    if (previous) {
      await this.updateFiscalDocuments({ id: previous.id, status: 'historica' } as any);
    }

    const created = first(
      await this.createFiscalDocuments({
        owner_type: input.owner_type,
        owner_id: input.owner_id,
        tax_id: input.tax_id,
        type: 'constancia',
        status: 'vigente',
        source: input.source ?? 'arca',
        snapshot: input.snapshot,
        snapshot_hash: input.snapshot_hash,
        file_id: input.file_id ?? null,
        file_url: input.file_url ?? null,
        requested_by: input.requested_by ?? null,
        generated_at: input.generated_at ?? new Date(),
        metadata: input.metadata ?? null,
      }),
    ) as unknown as FiscalDocumentRecord;

    const diff = previous
      ? diffSnapshots(previous.snapshot, input.snapshot)
      : [];

    return { document: created, previous, diff, changed: diff.length > 0 };
  }

  /**
   * Aplica la política de retención (baja lógica de versiones sobrantes):
   * - `keepHistory=false`: conserva solo la vigente.
   * - `maxVersions=n`: conserva las n más nuevas.
   * Nunca da de baja la versión vigente. Devuelve cuántas archivó.
   */
  async pruneVersions(
    ownerType: FiscalOwnerType,
    ownerId: string,
    opts: { keepHistory: boolean; maxVersions: number | null },
  ): Promise<number> {
    const all = await this.listByOwner(ownerType, ownerId);
    if (all.length <= 1) return 0;

    let toRemove: FiscalDocumentRecord[] = [];
    if (!opts.keepHistory) {
      toRemove = all.filter((d) => d.status !== 'vigente');
    } else if (typeof opts.maxVersions === 'number' && all.length > opts.maxVersions) {
      // `all` viene ordenado del más nuevo al más viejo.
      toRemove = all.slice(opts.maxVersions).filter((d) => d.status !== 'vigente');
    }

    if (!toRemove.length) return 0;
    await this.softDeleteFiscalDocuments(toRemove.map((d) => d.id));
    return toRemove.length;
  }

  /**
   * Compara dos documentos por id (deben pertenecer al mismo owner).
   * Si `otherId` se omite, compara `documentId` contra la versión inmediatamente
   * anterior del mismo owner.
   */
  async compare(
    documentId: string,
    otherId?: string,
  ): Promise<{ before: FiscalDocumentRecord; after: FiscalDocumentRecord; changes: FiscalDiffEntry[] }> {
    const doc = (await this.retrieveFiscalDocument(documentId)) as unknown as FiscalDocumentRecord;

    let other: FiscalDocumentRecord | null = null;
    if (otherId) {
      other = (await this.retrieveFiscalDocument(otherId)) as unknown as FiscalDocumentRecord;
      if (other.owner_type !== doc.owner_type || other.owner_id !== doc.owner_id) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          'Los documentos a comparar no pertenecen a la misma empresa.',
        );
      }
    } else {
      const history = await this.listByOwner(doc.owner_type, doc.owner_id);
      other = history.find((d) => new Date(d.created_at) < new Date(doc.created_at)) ?? null;
    }

    if (!other) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        'No hay una versión anterior con la cual comparar.',
      );
    }

    // Ordena cronológicamente: `before` = más antiguo, `after` = más nuevo.
    const [before, after] =
      new Date(other.created_at) < new Date(doc.created_at) ? [other, doc] : [doc, other];

    return { before, after, changes: diffSnapshots(before.snapshot, after.snapshot) };
  }
}

export default FiscalDocumentationModuleService;
