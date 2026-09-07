"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const models_1 = require("./models");
class MediaLibraryModuleService extends (0, utils_1.MedusaService)({
    MediaAsset: models_1.MediaAsset,
}) {
    /** Lista + búsqueda por nombre (ILIKE). */
    async search(q, opts = {}) {
        const filters = q
            ? { filename: { $ilike: `%${q}%` } }
            : {};
        return this.listAndCountMediaAssets(filters, {
            take: opts.limit ?? 100,
            skip: opts.offset ?? 0,
            order: { created_at: 'DESC' },
        });
    }
    /** Registra un asset; dedup por URL (si ya existe, lo devuelve). */
    async registerAsset(input) {
        const existing = await this.listMediaAssets({ url: input.url });
        if (existing[0])
            return existing[0];
        const created = await this.createMediaAssets({
            url: input.url,
            file_id: input.file_id ?? null,
            filename: input.filename,
            mime_type: input.mime_type ?? null,
            size: input.size ?? null,
            alt: input.alt ?? null,
            title: input.title ?? null,
            source: input.source ?? 'upload',
            metadata: input.metadata ?? null,
        });
        return Array.isArray(created) ? created[0] : created;
    }
    /** URLs ya presentes en el catálogo (para dedup en backfill). */
    async existingUrls(urls) {
        if (!urls.length)
            return new Set();
        const rows = await this.listMediaAssets({ url: urls });
        return new Set(rows.map((r) => r.url));
    }
}
exports.default = MediaLibraryModuleService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL21lZGlhLWxpYnJhcnkvc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLHFEQUEwRDtBQUMxRCxxQ0FBc0M7QUFHdEMsTUFBTSx5QkFBMEIsU0FBUSxJQUFBLHFCQUFhLEVBQUM7SUFDcEQsVUFBVSxFQUFWLG1CQUFVO0NBQ1gsQ0FBQztJQUNBLDJDQUEyQztJQUMzQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQXFCLEVBQUUsT0FBNEMsRUFBRTtRQUNoRixNQUFNLE9BQU8sR0FBRyxDQUFDO1lBQ2YsQ0FBQyxDQUFDLEVBQUUsUUFBUSxFQUFFLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtZQUNwQyxDQUFDLENBQUUsRUFBOEIsQ0FBQztRQUNwQyxPQUFPLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxPQUFPLEVBQUU7WUFDM0MsSUFBSSxFQUFFLElBQUksQ0FBQyxLQUFLLElBQUksR0FBRztZQUN2QixJQUFJLEVBQUUsSUFBSSxDQUFDLE1BQU0sSUFBSSxDQUFDO1lBQ3RCLEtBQUssRUFBRSxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUU7U0FDOUIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELG9FQUFvRTtJQUNwRSxLQUFLLENBQUMsYUFBYSxDQUFDLEtBQXNCO1FBQ3hDLE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLGVBQWUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztRQUNoRSxJQUFJLFFBQVEsQ0FBQyxDQUFDLENBQUM7WUFBRSxPQUFPLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNwQyxNQUFNLE9BQU8sR0FBRyxNQUFNLElBQUksQ0FBQyxpQkFBaUIsQ0FBQztZQUMzQyxHQUFHLEVBQUUsS0FBSyxDQUFDLEdBQUc7WUFDZCxPQUFPLEVBQUUsS0FBSyxDQUFDLE9BQU8sSUFBSSxJQUFJO1lBQzlCLFFBQVEsRUFBRSxLQUFLLENBQUMsUUFBUTtZQUN4QixTQUFTLEVBQUUsS0FBSyxDQUFDLFNBQVMsSUFBSSxJQUFJO1lBQ2xDLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSSxJQUFJLElBQUk7WUFDeEIsR0FBRyxFQUFFLEtBQUssQ0FBQyxHQUFHLElBQUksSUFBSTtZQUN0QixLQUFLLEVBQUUsS0FBSyxDQUFDLEtBQUssSUFBSSxJQUFJO1lBQzFCLE1BQU0sRUFBRSxLQUFLLENBQUMsTUFBTSxJQUFJLFFBQVE7WUFDaEMsUUFBUSxFQUFFLEtBQUssQ0FBQyxRQUFRLElBQUksSUFBSTtTQUNqQyxDQUFDLENBQUM7UUFDSCxPQUFPLEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO0lBQ3ZELENBQUM7SUFFRCxpRUFBaUU7SUFDakUsS0FBSyxDQUFDLFlBQVksQ0FBQyxJQUFjO1FBQy9CLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTTtZQUFFLE9BQU8sSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUNuQyxNQUFNLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQyxlQUFlLENBQUMsRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUN2RCxPQUFPLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFhLENBQUMsQ0FBQyxDQUFDO0lBQ25ELENBQUM7Q0FDRjtBQUVELGtCQUFlLHlCQUF5QixDQUFDIn0=