"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.arcaRateLimit = arcaRateLimit;
/**
 * Rate limit mínimo in-memory por IP para el lookup de ARCA (endpoint público
 * que gasta llamadas al padrón). Límite por container: con N réplicas el
 * efectivo es N×MAX, suficiente para MVP porque el cache por CUIT absorbe
 * repeticiones.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;
const MAX_ENTRIES = 5_000;
const hits = new Map();
function arcaRateLimit(req, res, next) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) ||
        req.socket?.remoteAddress ||
        'unknown';
    const now = Date.now();
    // Prune perezoso para acotar memoria bajo abuso distribuido.
    if (hits.size > MAX_ENTRIES) {
        for (const [key, entry] of hits) {
            if (now - entry.windowStart > WINDOW_MS)
                hits.delete(key);
        }
    }
    const entry = hits.get(ip);
    if (!entry || now - entry.windowStart > WINDOW_MS) {
        hits.set(ip, { count: 1, windowStart: now });
        next();
        return;
    }
    entry.count += 1;
    if (entry.count > MAX_PER_WINDOW) {
        res
            .status(429)
            .json({ message: 'Demasiadas consultas a ARCA. Esperá un minuto y volvé a intentar.' });
        return;
    }
    next();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmF0ZS1saW1pdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9hcGkvc3RvcmUvYXJjYS9yYXRlLWxpbWl0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBZUEsc0NBaUNDO0FBOUNEOzs7OztHQUtHO0FBRUgsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDO0FBQ3pCLE1BQU0sY0FBYyxHQUFHLENBQUMsQ0FBQztBQUN6QixNQUFNLFdBQVcsR0FBRyxLQUFLLENBQUM7QUFFMUIsTUFBTSxJQUFJLEdBQUcsSUFBSSxHQUFHLEVBQWtELENBQUM7QUFFdkUsU0FBZ0IsYUFBYSxDQUMzQixHQUFrQixFQUNsQixHQUFtQixFQUNuQixJQUF3QjtJQUV4QixNQUFNLFNBQVMsR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDakQsTUFBTSxFQUFFLEdBQ04sQ0FBQyxPQUFPLFNBQVMsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUM3RSxHQUFHLENBQUMsTUFBTSxFQUFFLGFBQWE7UUFDekIsU0FBUyxDQUFDO0lBQ1osTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBRXZCLDZEQUE2RDtJQUM3RCxJQUFJLElBQUksQ0FBQyxJQUFJLEdBQUcsV0FBVyxFQUFFLENBQUM7UUFDNUIsS0FBSyxNQUFNLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDO1lBQ2hDLElBQUksR0FBRyxHQUFHLEtBQUssQ0FBQyxXQUFXLEdBQUcsU0FBUztnQkFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzVELENBQUM7SUFDSCxDQUFDO0lBRUQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUMzQixJQUFJLENBQUMsS0FBSyxJQUFJLEdBQUcsR0FBRyxLQUFLLENBQUMsV0FBVyxHQUFHLFNBQVMsRUFBRSxDQUFDO1FBQ2xELElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxXQUFXLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztRQUM3QyxJQUFJLEVBQUUsQ0FBQztRQUNQLE9BQU87SUFDVCxDQUFDO0lBQ0QsS0FBSyxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUM7SUFDakIsSUFBSSxLQUFLLENBQUMsS0FBSyxHQUFHLGNBQWMsRUFBRSxDQUFDO1FBQ2pDLEdBQUc7YUFDQSxNQUFNLENBQUMsR0FBRyxDQUFDO2FBQ1gsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLG1FQUFtRSxFQUFFLENBQUMsQ0FBQztRQUMxRixPQUFPO0lBQ1QsQ0FBQztJQUNELElBQUksRUFBRSxDQUFDO0FBQ1QsQ0FBQyJ9