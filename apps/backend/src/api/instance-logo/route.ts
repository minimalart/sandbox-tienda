import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { buildInitialFaviconSvg, colorOf } from '../instance-branding/branding';
import { readInstanceBranding } from '../instance-branding/read';

/**
 * GET /instance-logo — el logo de ESTA instalación, como imagen.
 *
 * Hermano de `/favicon.ico`, con la prioridad al revés: acá gana el logo HORIZONTAL,
 * porque los consumidores lo dibujan a 40px de alto y con ancho libre.
 *
 *   1. `theme.logo` — el logotipo.
 *   2. `theme.icon` — el isotipo, si no hay logotipo.
 *   3. generado — el mismo cuadrado con la inicial que sirve `/favicon.ico`.
 *
 * ── Por qué existe una ruta y no se pasa la marca por parámetro ──────────────────
 *
 * Los consumidores son páginas HTML que el backend arma con template strings
 * SÍNCRONOS (`invitations/accept`, `mcp/oauth/authorize`). Leer la marca es async, así
 * que meterla adentro obligaría a volver async a los cuatro constructores de página y
 * a sus ~10 call sites. Una `<img src="/instance-logo">` deja esos archivos como
 * están: se sirven desde el mismo origen, así que la ruta relativa siempre resuelve.
 *
 * ⚠ ESAS PÁGINAS TENÍAN EL LOGO DE MERCATTO EN DURO
 * (`${STOREFRONT_URL}/logos-mercatto/logo-verde.svg`, con el dominio de Mercatto de
 * default). Las ve el cliente: una es la pantalla donde un usuario ACEPTA su
 * invitación al panel, la otra la que autoriza el conector de IA. Las dos mostraban
 * la marca equivocada, y como se ven bien, nadie las reporta.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const branding = await readInstanceBranding(req.scope);
  const uploaded = branding.logo ?? branding.icon;

  if (uploaded) {
    // 302 y no 301: la marca se edita desde el admin y un permanente se queda pegado
    // en el navegador hasta que alguien limpie la caché.
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.redirect(302, uploaded);
    return;
  }

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.send(buildInitialFaviconSvg(branding.name, colorOf(branding)));
}
