"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toReferenceDataUrls = toReferenceDataUrls;
const sharp_1 = __importDefault(require("sharp"));
/**
 * Descarga imágenes de producto (URLs de S3/CDN) y las normaliza a data URLs
 * JPEG listas para mandar como REFERENCIA al modelo de imagen (nano banana).
 * Se achican a 768px (suficiente para que el modelo "entienda" el producto sin
 * inflar el payload) y se aplanan sobre blanco por si vienen con transparencia.
 *
 * Es best-effort: una imagen que no baja o no decodifica se saltea (no rompe la
 * generación). Devuelve como mucho `max` referencias.
 */
const FETCH_TIMEOUT_MS = 12_000;
async function toReferenceDataUrls(imageUrls, max = 4) {
    const urls = imageUrls
        .filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u))
        .slice(0, max);
    const out = [];
    for (const url of urls) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
            const res = await fetch(url, { signal: controller.signal });
            if (!res.ok)
                continue;
            const input = Buffer.from(await res.arrayBuffer());
            const normalized = await (0, sharp_1.default)(input)
                .flatten({ background: '#ffffff' })
                .resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 85 })
                .toBuffer();
            out.push(`data:image/jpeg;base64,${normalized.toString('base64')}`);
        }
        catch {
            /* imagen inaccesible o no decodificable: se saltea */
        }
        finally {
            clearTimeout(timeout);
        }
    }
    return out;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvZHVjdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9iYW5uZXIvYWkvcHJvZHVjdHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFhQSxrREE2QkM7QUExQ0Qsa0RBQTBCO0FBRTFCOzs7Ozs7OztHQVFHO0FBQ0gsTUFBTSxnQkFBZ0IsR0FBRyxNQUFNLENBQUM7QUFFekIsS0FBSyxVQUFVLG1CQUFtQixDQUN2QyxTQUEyQyxFQUMzQyxHQUFHLEdBQUcsQ0FBQztJQUVQLE1BQU0sSUFBSSxHQUFHLFNBQVM7U0FDbkIsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFlLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxRQUFRLElBQUksZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUM1RSxLQUFLLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBRWpCLE1BQU0sR0FBRyxHQUFhLEVBQUUsQ0FBQztJQUN6QixLQUFLLE1BQU0sR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDO1FBQ3ZCLE1BQU0sVUFBVSxHQUFHLElBQUksZUFBZSxFQUFFLENBQUM7UUFDekMsTUFBTSxPQUFPLEdBQUcsVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ3ZFLElBQUksQ0FBQztZQUNILE1BQU0sR0FBRyxHQUFHLE1BQU0sS0FBSyxDQUFDLEdBQUcsRUFBRSxFQUFFLE1BQU0sRUFBRSxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztZQUM1RCxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUU7Z0JBQUUsU0FBUztZQUN0QixNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7WUFDbkQsTUFBTSxVQUFVLEdBQUcsTUFBTSxJQUFBLGVBQUssRUFBQyxLQUFLLENBQUM7aUJBQ2xDLE9BQU8sQ0FBQyxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsQ0FBQztpQkFDbEMsTUFBTSxDQUFDLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxRQUFRLEVBQUUsa0JBQWtCLEVBQUUsSUFBSSxFQUFFLENBQUM7aUJBQzVFLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsQ0FBQztpQkFDckIsUUFBUSxFQUFFLENBQUM7WUFDZCxHQUFHLENBQUMsSUFBSSxDQUFDLDBCQUEwQixVQUFVLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUN0RSxDQUFDO1FBQUMsTUFBTSxDQUFDO1lBQ1Asc0RBQXNEO1FBQ3hELENBQUM7Z0JBQVMsQ0FBQztZQUNULFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN4QixDQUFDO0lBQ0gsQ0FBQztJQUNELE9BQU8sR0FBRyxDQUFDO0FBQ2IsQ0FBQyJ9