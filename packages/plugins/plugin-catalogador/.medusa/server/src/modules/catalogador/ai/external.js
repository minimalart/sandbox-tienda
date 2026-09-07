"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractImageUrls = extractImageUrls;
exports.gatherExternalContext = gatherExternalContext;
const settings_1 = require("../settings");
const ssrf_1 = require("./ssrf");
const barcode_1 = require("./barcode");
/** Sanea HTML a texto plano acotado antes de pasarlo al LLM (evita inyección). */
function htmlToText(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 2000);
}
/**
 * Extrae URLs de imagen de una respuesta JSON arbitraria de un proveedor de
 * barcode (recorrido recursivo acotado). Acepta strings http(s) cuyo path
 * termina en extensión de imagen, o bajo claves que sugieren imagen
 * (`image`, `images`, `image_url`, `thumbnail`, `photo`, `picture`, …).
 * Exportada para tests.
 */
function extractImageUrls(value, limit = 6) {
    const found = [];
    const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i;
    const IMAGE_KEY = /(image|img|photo|picture|thumbnail)/i;
    let visited = 0;
    const walk = (node, keyHint, depth) => {
        if (found.length >= limit || depth > 6 || visited > 500)
            return;
        visited++;
        if (typeof node === 'string') {
            const url = node.trim();
            if (!/^https?:\/\//i.test(url))
                return;
            if ((keyHint || IMAGE_EXT.test(url)) && !found.includes(url))
                found.push(url);
            return;
        }
        if (Array.isArray(node)) {
            for (const item of node)
                walk(item, keyHint, depth + 1);
            return;
        }
        if (node && typeof node === 'object') {
            for (const [key, val] of Object.entries(node)) {
                walk(val, IMAGE_KEY.test(key), depth + 1);
            }
        }
    };
    walk(value, false, 0);
    return found;
}
/**
 * Consulta por barcode contra un proveedor genérico configurado en los ajustes
 * de la extensión (`CATALOGADOR_BARCODE_API_URL` con `{code}` +
 * `CATALOGADOR_BARCODE_API_KEY`).
 * Sin garantía de match (PRD §5). Devuelve un resumen textual (más las URLs de
 * imagen que traiga la respuesta, para usarlas como referencia) o null.
 */
async function lookupBarcode(barcode, timeoutMs) {
    const { barcodeApiUrl: template, barcodeApiKey: apiKey } = (0, settings_1.getCatalogadorSettings)();
    if (!template)
        return null;
    const url = template.replace('{code}', encodeURIComponent(barcode));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
        });
        if (!res.ok)
            return { text: '', ok: false, images: [] };
        const json = (await res.json().catch(() => null));
        if (!json)
            return { text: '', ok: false, images: [] };
        // Resumen genérico: aplanamos campos de texto útiles que suelen venir.
        const text = JSON.stringify(json).slice(0, 1500);
        return { text, ok: true, images: extractImageUrls(json) };
    }
    catch {
        return { text: '', ok: false, images: [] };
    }
    finally {
        clearTimeout(timer);
    }
}
/**
 * Scraping/búsqueda web controlada. La HERRAMIENTA la define
 * `config.external.scraping_provider`:
 *  - 'tavily' (recomendado): API de búsqueda de Tavily, que busca y devuelve el
 *    contenido ya extraído; restringe a los dominios permitidos con
 *    `include_domains`. Requiere `CATALOGADOR_TAVILY_API_KEY`.
 *  - 'http': fetch directo endurecido anti-SSRF de un template de búsqueda por
 *    dominio (`CATALOGADOR_SCRAPE_SEARCH_TEMPLATE` con `{domain}`/`{query}`).
 */
async function scrapeControlled(query, config) {
    const ext = config.external;
    if (ext.scraping_provider === 'tavily') {
        return scrapeTavily(query, config);
    }
    return scrapeHttp(query, config);
}
/** Tavily Search API — busca y devuelve contenido; respeta include_domains. */
async function scrapeTavily(query, config) {
    const ext = config.external;
    const sources = [];
    const warnings = [];
    const snippets = [];
    const images = [];
    const { tavilyApiKey: apiKey } = (0, settings_1.getCatalogadorSettings)();
    if (!apiKey) {
        warnings.push('Scraping (tavily) habilitado pero falta CATALOGADOR_TAVILY_API_KEY.');
        return { snippets, sources, warnings, images };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ext.timeout_ms);
    try {
        const res = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: apiKey,
                query,
                search_depth: 'basic',
                max_results: Math.max(1, ext.max_pages_per_product),
                include_answer: false,
                include_images: true,
                ...(ext.allowed_domains.length ? { include_domains: ext.allowed_domains } : {}),
                ...(ext.blocked_domains.length ? { exclude_domains: ext.blocked_domains } : {}),
            }),
        });
        if (!res.ok) {
            warnings.push(`Tavily respondió ${res.status}`);
            sources.push({ type: 'scraping', ref: 'tavily', ok: false, note: `HTTP ${res.status}` });
            return { snippets, sources, warnings, images };
        }
        const data = (await res.json().catch(() => null));
        for (const r of data?.results ?? []) {
            const text = htmlToText(r.content ?? '');
            if (text)
                snippets.push(`[${r.url ?? 'tavily'}] ${text}`);
            sources.push({ type: 'scraping', ref: r.url ?? 'tavily', ok: Boolean(text) });
        }
        for (const img of data?.images ?? []) {
            const url = typeof img === 'string' ? img : img?.url;
            if (url && /^https?:\/\//i.test(url))
                images.push(url);
        }
    }
    catch (e) {
        warnings.push(`Tavily: ${e instanceof Error ? e.message : 'fetch falló'}`);
        sources.push({ type: 'scraping', ref: 'tavily', ok: false });
    }
    finally {
        clearTimeout(timer);
    }
    return { snippets, sources, warnings, images };
}
/** Fetch directo endurecido anti-SSRF (provider 'http'). */
async function scrapeHttp(query, config) {
    const ext = config.external;
    const sources = [];
    const warnings = [];
    const snippets = [];
    const images = [];
    const { scrapeSearchTemplate: template } = (0, settings_1.getCatalogadorSettings)();
    if (!template || ext.allowed_domains.length === 0) {
        if (!template)
            warnings.push('Scraping (http) sin CATALOGADOR_SCRAPE_SEARCH_TEMPLATE.');
        return { snippets, sources, warnings, images };
    }
    const domains = ext.allowed_domains.slice(0, ext.max_pages_per_product);
    for (const domain of domains) {
        const target = template
            .replace('{domain}', encodeURIComponent(domain))
            .replace('{query}', encodeURIComponent(query));
        try {
            const html = await (0, ssrf_1.safeFetchText)(target, {
                allowedDomains: ext.allowed_domains,
                blockedDomains: ext.blocked_domains,
                timeoutMs: ext.timeout_ms,
                userAgent: ext.user_agent,
            });
            const text = htmlToText(html);
            if (text)
                snippets.push(`[${domain}] ${text}`);
            sources.push({ type: 'scraping', ref: domain, ok: Boolean(text) });
        }
        catch (e) {
            const note = e instanceof ssrf_1.SsrfError ? e.message : 'fetch falló';
            warnings.push(`Scraping ${domain}: ${note}`);
            sources.push({ type: 'scraping', ref: domain, ok: false, note });
        }
    }
    return { snippets, sources, warnings, images };
}
/** Orquesta barcode + scraping según config; devuelve contexto para la IA. */
async function gatherExternalContext(opts) {
    const { config, title } = opts;
    const ext = config.external;
    if (!ext.barcode_enabled && !ext.scraping_enabled)
        return null;
    const sources = [];
    const warnings = [];
    const parts = [];
    const images = [];
    let usedBarcode = false;
    let usedScraping = false;
    let pageHits = 0;
    // Validar el código antes de gastar llamadas: un SKU o código interno (no
    // EAN/UPC/GTIN con dígito de control válido) se trata como "sin barcode".
    const barcode = opts.barcode && (0, barcode_1.isValidBarcode)(opts.barcode) ? opts.barcode : null;
    if (opts.barcode && !barcode) {
        warnings.push(`El código "${opts.barcode}" no es un barcode válido (EAN/UPC/GTIN); se ignora.`);
    }
    if (ext.barcode_enabled && barcode) {
        const r = await lookupBarcode(barcode, ext.timeout_ms);
        if (r) {
            sources.push({ type: 'barcode', ref: barcode, ok: r.ok });
            if (r.ok && r.text) {
                parts.push(`Datos por barcode (${barcode}): ${r.text}`);
                usedBarcode = true;
            }
            // Las imágenes del proveedor de barcode van PRIMERO: son las de mayor
            // probabilidad de corresponder exactamente al producto.
            for (const img of r.images)
                if (!images.includes(img))
                    images.push(img);
        }
    }
    if (ext.scraping_enabled) {
        // Dos intentos: (1) el barcode exacto entre comillas — la búsqueda más
        // específica; (2) sólo si no hubo resultados, barcode + título. Sin barcode
        // válido se busca por título como antes.
        const attempts = barcode ? [`"${barcode}"`, `"${barcode}" ${title}`] : [title];
        for (const query of attempts) {
            const s = await scrapeControlled(query, config);
            sources.push(...s.sources);
            warnings.push(...s.warnings);
            for (const img of s.images)
                if (!images.includes(img))
                    images.push(img);
            if (s.snippets.length) {
                parts.push(...s.snippets);
                pageHits += s.snippets.length;
                usedScraping = true;
                break; // el primer intento con resultados alcanza
            }
        }
    }
    return {
        summary: parts.length ? parts.join('\n') : null,
        sources,
        used_barcode: usedBarcode,
        used_scraping: usedScraping,
        page_hits: pageHits,
        image_candidates: images.slice(0, 6),
        warnings,
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZXJuYWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9jYXRhbG9nYWRvci9haS9leHRlcm5hbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQW9EQSw0Q0EwQkM7QUF3SkQsc0RBa0VDO0FBdlNELDBDQUFxRDtBQUNyRCxpQ0FBa0Q7QUFDbEQsdUNBQTJDO0FBOEIzQyxrRkFBa0Y7QUFDbEYsU0FBUyxVQUFVLENBQUMsSUFBWTtJQUM5QixPQUFPLElBQUk7U0FDUixPQUFPLENBQUMsNkJBQTZCLEVBQUUsR0FBRyxDQUFDO1NBQzNDLE9BQU8sQ0FBQywyQkFBMkIsRUFBRSxHQUFHLENBQUM7U0FDekMsT0FBTyxDQUFDLFVBQVUsRUFBRSxHQUFHLENBQUM7U0FDeEIsT0FBTyxDQUFDLFlBQVksRUFBRSxHQUFHLENBQUM7U0FDMUIsT0FBTyxDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUM7U0FDcEIsSUFBSSxFQUFFO1NBQ04sS0FBSyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUNwQixDQUFDO0FBRUQ7Ozs7OztHQU1HO0FBQ0gsU0FBZ0IsZ0JBQWdCLENBQUMsS0FBYyxFQUFFLEtBQUssR0FBRyxDQUFDO0lBQ3hELE1BQU0sS0FBSyxHQUFhLEVBQUUsQ0FBQztJQUMzQixNQUFNLFNBQVMsR0FBRyxzQ0FBc0MsQ0FBQztJQUN6RCxNQUFNLFNBQVMsR0FBRyxzQ0FBc0MsQ0FBQztJQUN6RCxJQUFJLE9BQU8sR0FBRyxDQUFDLENBQUM7SUFDaEIsTUFBTSxJQUFJLEdBQUcsQ0FBQyxJQUFhLEVBQUUsT0FBZ0IsRUFBRSxLQUFhLEVBQVEsRUFBRTtRQUNwRSxJQUFJLEtBQUssQ0FBQyxNQUFNLElBQUksS0FBSyxJQUFJLEtBQUssR0FBRyxDQUFDLElBQUksT0FBTyxHQUFHLEdBQUc7WUFBRSxPQUFPO1FBQ2hFLE9BQU8sRUFBRSxDQUFDO1FBQ1YsSUFBSSxPQUFPLElBQUksS0FB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