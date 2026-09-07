"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const models_1 = require("./models");
const snapshot_1 = require("./snapshot");
function first(res) {
    return (Array.isArray(res) ? res[0] : res);
}
class FiscalDocumentationModuleService extends (0, utils_1.MedusaService)({ FiscalDocument: models_1.FiscalDocument }) {
    /** Documentos de un owner, más nuevo primero. */
    async listByOwner(ownerType, ownerId) {
        const rows = await this.listFiscalDocuments({ owner_type: ownerType, owner_id: ownerId }, { order: { created_at: 'DESC' } });
        return rows;
    }
    /** La constancia vigente del owner (o null). */
    async getCurrent(ownerType, ownerId) {
        const rows = await this.listFiscalDocuments({ owner_type: ownerType, owner_id: ownerId, status: 'vigente' }, { order: { created_at: 'DESC' } });
        return rows[0] ?? null;
    }
    /**
     * Crea una versión nueva y la marca `vigente`, archivando la anterior como
     * `historica`. Nunca reemplaza documentos: el historial es append-only.
     * Devuelve el documento nuevo, la versión anterior (si había) y el diff.
     */
    async createVersion(input) {
        const previous = await this.getCurrent(input.owner_type, input.owner_id);
        if (previous) {
            await this.updateFiscalDocuments({ id: previous.id, status: 'historica' });
        }
        const created = first(await this.createFiscalDocuments({
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
        }));
        const diff = previous
            ? (0, snapshot_1.diffSnapshots)(previous.snapshot, input.snapshot)
            : [];
        return { document: created, previous, diff, changed: diff.length > 0 };
    }
    /**
     * Aplica la política de retención (baja lógica de versiones sobrantes):
     * - `keepHistory=false`: conserva solo la vigente.
     * - `maxVersions=n`: conserva las n más nuevas.
     * Nunca da de baja la versión vigente. Devuelve cuántas archivó.
     */
    async pruneVersions(ownerType, ownerId, opts) {
        const all = await this.listByOwner(ownerType, ownerId);
        if (all.length <= 1)
            return 0;
        let toRemove = [];
        if (!opts.keepHistory) {
            toRemove = all.filter((d) => d.status !== 'vigente');
        }
        else if (typeof opts.maxVersions === 'number' && all.length > opts.maxVersions) {
            // `all` viene ordenado del más nuevo al más viejo.
            toRemove = all.slice(opts.maxVersions).filter((d) => d.status !== 'vigente');
        }
        if (!toRemove.length)
            return 0;
        await this.softDeleteFiscalDocuments(toRemove.map((d) => d.id));
        return toRemove.length;
    }
    /**
     * Compara dos documentos por id (deben pertenecer al mismo owner).
     * Si `otherId` se omite, compara `documentId` contra la versión inmediatamente
     * anterior del mismo owner.
     */
    async compare(documentId, otherId) {
        const doc = (await this.retrieveFiscalDocument(documentId));
        let other = null;
        if (otherId) {
            other = (await this.retrieveFiscalDocument(otherId));
            if (other.owner_type !== doc.owner_type || other.owner_id !== doc.owner_id) {
                throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, 'Los documentos a comparar no pertenecen a la misma empresa.');
            }
        }
        else {
            const history = await this.listByOwner(doc.owner_type, doc.owner_id);
            other = history.find((d) => new Date(d.created_at) < new Date(doc.created_at)) ?? null;
        }
        if (!other) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, 'No hay una versión anterior con la cual comparar.');
        }
        // Ordena cronológicamente: `before` = más antiguo, `after` = más nuevo.
        const [before, after] = new Date(other.created_at) < new Date(doc.created_at) ? [other, doc] : [doc, other];
        return { before, after, changes: (0, snapshot_1.diffSnapshots)(before.snapshot, after.snapshot) };
    }
}
exports.default = FiscalDocumentationModuleService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2Zpc2NhbC1kb2N1bWVudGF0aW9uL3NlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxxREFBdUU7QUFDdkUscUNBQTBDO0FBQzFDLHlDQUEyQztBQXVCM0MsU0FBUyxLQUFLLENBQUksR0FBWTtJQUM1QixPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQU0sQ0FBQztBQUNsRCxDQUFDO0FBRUQsTUFBTSxnQ0FBaUMsU0FBUSxJQUFBLHFCQUFhLEVBQUMsRUFBRSxjQUFjLEVBQWQsdUJBQWMsRUFBRSxDQUFDO0lBQzlFLGlEQUFpRDtJQUNqRCxLQUFLLENBQUMsV0FBVyxDQUNmLFNBQTBCLEVBQzFCLE9BQWU7UUFFZixNQUFNLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQyxtQkFBbUIsQ0FDekMsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsRUFDNUMsRUFBRSxLQUFLLEVBQUUsRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLEVBQUUsQ0FDbEMsQ0FBQztRQUNGLE9BQU8sSUFBeUMsQ0FBQztJQUNuRCxDQUFDO0lBRUQsZ0RBQWdEO0lBQ2hELEtBQUssQ0FBQyxVQUFVLENBQ2QsU0FBMEIsRUFDMUIsT0FBZTtRQUVmLE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBSSxDQUFDLG1CQUFtQixDQUN6QyxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLEVBQy9ELEVBQUUsS0FBSyxFQUFFLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxFQUFFLENBQ2xDLENBQUM7UUFDRixPQUFRLElBQUksQ0FBQyxDQUFD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