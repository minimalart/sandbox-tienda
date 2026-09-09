import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { buildInitialFaviconSvg, colorOf } from '../instance-branding/branding';
import { readInstanceBranding } from '../instance-branding/read';

/**
 * Favicon del backend: el de ESTA instalación.
 *
 * Medusa no sirve `/favicon.ico` en la raíz, y hace falta en dos lugares: el conector
 * MCP (claude.ai / ChatGPT) toma el favicon del ORIGEN del backend para su ícono, y el
 * admin apunta acá su `<link rel="icon">` — que de fábrica viene en blanco, porque
 * `admin-bundler` escribe `href="data:,"`.
 *
 * ⚠ ANTES ESTO ERA EL LOGO DE MERCATTO, EN DURO. Un SVG verde embebido en el archivo,
 * servido por el backend de todos los clientes: el conector MCP de cualquier marca
 * mostraba el isotipo de Mercatto, y el admin también en cuanto alguien le pusiera un
 * favicon. Es la peor forma del bug de marca ajena — se ve bien, así que nadie lo
 * reporta. Misma familia que el literal de dominio que documenta
 * `admin/hooks/use-storefront-base.ts`.
 *
 * PRIORIDAD, y esta ruta es el único lugar donde se decide (el admin no la
 * reimplementa, apunta acá):
 *
 *   1. `theme.favicon` — el que la marca cargó a propósito.
 *   2. `theme.icon` — el isotipo. Cuadrado, así que a 16px se lee.
 *   3. generado — cuadrado del color de la marca con la inicial del nombre.
 *
 * El logo horizontal NO entra: a 16px un logotipo apaisado es una mancha.
 *
 * Los dos primeros son URLs absolutas (S3), así que se responden con un redirect en
 * vez de proxear los bytes: el backend no tiene por qué ponerse en el camino de una
 * descarga que el CDN ya sirve mejor.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const branding = await readInstanceBranding(req.scope);
  const uploaded = branding.favicon ?? branding.icon;

  if (uploaded) {
    // 302 y no 301: la marca se edita desde el admin y un permanente se queda pegado
    // en el navegador del operador hasta que limpie la caché.
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.redirect(302, uploaded);
    return;
  }

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.send(buildInitialFaviconSvg(branding.name, colorOf(branding)));
}
