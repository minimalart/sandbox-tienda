import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { ERP_MODULE } from '../../../../../modules/erp';
import type ErpModuleService from '../../../../../modules/erp/service';
import type { TintingFormulaRow } from '../../../../../modules/erp/service';
import type { DeleteErpTintingFormulasType } from '../../validators';
import { resolveTintingReadiness } from '../../../../../modules/erp/tinting/readiness';

/**
 * DELETE /admin/erp/tinting/formulas — borra fórmulas por su clave natural
 * `(collection, color_code, product_line, base_letter)`.
 *
 * Faltaba la contraparte de `DELETE /admin/erp/tinting/colors`: el import sólo
 * crea, actualiza y reactiva, nunca desactiva. Una fórmula que el ERP dejó de
 * reconocer quedaba en la tabla para siempre, y el comprador la descubría recién
 * al elegir el envase, con un 422 en la cara.
 *
 * Pasó de verdad: al recargar la carta de Alba aparecieron **858 fórmulas
 * cargadas el 2026-07-30 que Zeus hoy rechaza** —831 de las tres líneas REVEAR
 * (letras P y F) y 27 de ALBALATEX DESIGN SATINADO—, verificadas una por una
 * contra `price-probe`. Sin esta ruta no había forma de sacarlas por API.
 *
 * **Borra sólo lo que se nombra.** No acepta borrar "toda una línea" ni "toda una
 * carta": un flag así, con un payload mal armado, se lleva puesta la tabla que
 * hace vendibles a los colores. Cada fila va explícita, y las que no existen se
 * informan en `not_found` en vez de fallar en silencio.
 *
 * El borrado es soft (marca `deleted_at`), así que es reversible desde la base si
 * alguien se equivoca de lote.
 */
export async function DELETE(
  req: MedusaRequest<DeleteErpTintingFormulasType>,
  res: MedusaResponse
): Promise<void> {
  const body = req.validatedBody;
  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);

  const collection = body.collection.trim();
  const wanted = body.items.map((item) => ({
    color_code: item.color_code.trim(),
    product_line: item.product_line.trim(),
    // Nulo NO es "cualquiera": es la línea de base única. Se compara como tal.
    base_letter: item.base_letter?.trim().toUpperCase() || null,
  }));

  const keyOf = (row: { color_code: string; product_line: string; base_letter: string | null }) =>
    `${row.color_code}::${row.product_line}::${row.base_letter ?? ''}`;

  // Se trae por (carta, color) y el filtro fino se hace en JS: armar un OR de N
  // triples en el query builder por 858 filas no compensa, y el universo de una
  // carta entra holgado en memoria.
  const candidates = (await service.listErpTintingFormulas(
    { collection, color_code: [...new Set(wanted.map((w) => w.color_code))] },
    { take: null }
  )) as unknown as TintingFormulaRow[];

  const byKey = new Map(candidates.map((row) => [keyOf(row), row]));
  const found: TintingFormulaRow[] = [];
  const notFound: typeof wanted = [];
  const seen = new Set<string>();

  for (const item of wanted) {
    const key = keyOf(item);
    // Un lote repetido no tiene que contar dos veces la misma fila.
    if (seen.has(key)) continue;
    seen.add(key);
    const row = byKey.get(key);
    if (row) found.push(row);
    else notFound.push(item);
  }

  if (!found.length) {
    res.status(404).json({
      message: `Ninguna de esas ${wanted.length} fórmulas existe en la carta ${collection}.`,
      not_found: notFound.slice(0, 20),
    });
    return;
  }

  if (body.dry_run !== false) {
    res.json({
      dry_run: true,
      would_delete: found.length,
      not_found: notFound.length,
      items: found.slice(0, 20).map((row) => ({
        color_code: row.color_code,
        product_line: row.product_line,
        base_letter: row.base_letter,
      })),
      readiness: await resolveTintingReadiness(req.scope, service),
    });
    return;
  }

  await service.deleteErpTintingFormulas(found.map((row) => row.id));

  res.json({
    dry_run: false,
    deleted: found.length,
    not_found: notFound.length,
    items: found.slice(0, 20).map((row) => ({
      color_code: row.color_code,
      product_line: row.product_line,
      base_letter: row.base_letter,
    })),
    readiness: await resolveTintingReadiness(req.scope, service),
  });
}
