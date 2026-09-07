import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * La clave con la que un módulo se registra en el container es un SEAM entre el
 * boilerplate y los proyectos generados: `project-composer` puede borrar el módulo
 * de un proyecto de cliente, pero SÍ le entrega extensiones que lo consumen. Por eso
 * esos archivos resuelven el módulo por STRING LITERAL dentro de un try/catch en vez
 * de importar la constante: un import al módulo ausente quedaría colgado y el backend
 * del cliente no compilaría.
 *
 * El precio de ese desacople es que los literales pueden driftear de la constante
 * SIN QUE NADA FALLE, porque el catch degrada en silencio. Dos incidentes reales:
 *
 *   - `store-config/site-gate.ts` devuelve `null` en el catch → un literal desalineado
 *     APAGA EL PASSWORD GATE DE TODAS LAS TIENDAS sin un solo error en los logs.
 *   - `fiscal-documents/_helpers.ts` usaba `'site-manager'` (el nombre de la CARPETA)
 *     cuando la clave es `'siteManager'` → la config fiscal leía siempre los defaults
 *     y el guardado tiraba siempre. Estuvo roto sin que nadie lo notara porque este
 *     test sólo vigilaba `demo_store`.
 *
 * Este test es lo que convierte esos incidentes silenciosos en un test rojo. Si
 * renombrás la clave de un módulo, falla acá y te dice exactamente qué archivos
 * tienen que acompañar el cambio.
 */

const MODULES_DIR = import.meta.dirname;
const BACKEND_DIR = join(MODULES_DIR, '..', '..');

/** Dónde se registra cada módulo en el container. */
const MEDUSA_CONFIG = join(BACKEND_DIR, 'medusa-config.ts');

/**
 * Los módulos cuya clave es un seam, y los archivos que la repiten como literal.
 * Agregar acá cualquier lugar nuevo que resuelva un módulo por string.
 */
const GUARDED_MODULES = [
  {
    folder: 'demo-store',
    constant: 'DEMO_STORE_MODULE',
    seams: [
      {
        path: join(BACKEND_DIR, 'src', 'lib', 'multistore', 'module-key.ts'),
        label: 'lib/multistore/module-key.ts',
        extension: 'core (seam multitienda)',
        // Este archivo repite el literal en DOS constantes (la clave del container y
        // el nombre de la tabla). Con `includes` a secas, cambiar una y dejar la otra
        // daba verde: hay que atar la constante concreta.
        assign: 'SITE_REGISTRY_MODULE',
        onDrift:
          'resolveSite() devuelve SIEMPRE registryAbsent y NINGUNA ruta filtra por tienda, sin un solo error: el admin muestra todas las tiendas creyendo que muestra una',
      },
      {
        path: join(MODULES_DIR, 'recurring-order', 'toggle.ts'),
        label: 'modules/recurring-order/toggle.ts',
        extension: 'recurring-orders',
        onDrift: 'isRecurringEnabledForChannel() cae al env y se ignora el toggle por tienda',
      },
      {
        path: join(BACKEND_DIR, 'src', 'api', 'store', 'b2b', 'pricing-region.ts'),
        label: 'api/store/b2b/pricing-region.ts',
        extension: 'b2b',
        onDrift:
          'b2bPricingRegion() cae a regions[0] y el catálogo mayorista puede mostrar precios en null',
      },
      {
        path: join(MODULES_DIR, 'store-config', 'site-gate.ts'),
        label: 'modules/store-config/site-gate.ts',
        extension: 'store-config',
        onDrift:
          'resolveDemoStoreService() devuelve null y SE APAGA EL PASSWORD GATE DE TODAS LAS TIENDAS, sin error en logs',
      },
      {
        path: join(BACKEND_DIR, 'src', 'api', 'admin', 'fiscal-documents', '_helpers.ts'),
        label: 'api/admin/fiscal-documents/_helpers.ts',
        extension: 'fiscal-documentation',
        onDrift:
          'readFiscalConfig() devuelve SIEMPRE los defaults y writeFiscalConfig() tira siempre: la config fiscal deja de guardarse',
      },
    ],
  },
];

/** Fuente de verdad de la clave: la constante que exporta el propio módulo. */
function readModuleKey(folder: string, constant: string): string | null {
  const index = join(MODULES_DIR, folder, 'index.ts');
  // Proyecto generado (o módulo ya desmantelado): no hay nada que validar.
  if (!existsSync(index)) return null;
  const src = readFileSync(index, 'utf8');
  const match = new RegExp(`export const ${constant}\\s*=\\s*'([^']+)'`).exec(src);
  assert.ok(
    match,
    `No pude leer ${constant} de ${index}. Si cambiaste el nombre de la constante, ` +
      `actualizá este test: es el único guard del seam por string literal.`
  );
  return match[1]!;
}

for (const mod of GUARDED_MODULES) {
  test(`la clave del módulo ${mod.folder} se registra en medusa-config con el mismo valor`, () => {
    const key = readModuleKey(mod.folder, mod.constant);
    if (!key) return;

    const config = readFileSync(MEDUSA_CONFIG, 'utf8');
    const match = new RegExp(
      `optionalModule\\(\\s*'([^']+)'\\s*,\\s*'${mod.folder}'\\s*\\)`
    ).exec(config);
    assert.ok(
      match,
      `medusa-config.ts no registra la carpeta '${mod.folder}' con optionalModule(). Sin ese ` +
        `registro el módulo no existe en el container y los seams por string literal caen a ` +
        `su rama de degradación EN SILENCIO.`
    );
    assert.equal(
      match[1],
      key,
      `medusa-config.ts registra '${mod.folder}' bajo la clave '${match[1]}' pero ` +
        `${mod.constant} vale '${key}'. Todo container.resolve(${mod.constant}) va a tirar y, ` +
        `en los seams con try/catch, a degradar sin error.`
    );
  });

  test(`los seams por string literal de ${mod.folder} usan la misma clave que el módulo`, () => {
    const key = readModuleKey(mod.folder, mod.constant);
    if (!key) return;

    const literal = `'${key}'`;
    for (const seam of mod.seams) {
      // La extensión puede no estar instalada en este checkout.
      if (!existsSync(seam.path)) continue;
      const src = readFileSync(seam.path, 'utf8');

      // Cuando el seam declara `assign`, se ata la CONSTANTE, no la mera presencia del
      // string: un archivo que repite el literal en dos constantes daría verde con
      // `includes` aunque la que importa esté desalineada.
      const assign = (seam as { assign?: string }).assign;
      const found = assign
        ? new RegExp(`export const ${assign}\\s*=\\s*${literal}`).test(src)
        : src.includes(literal);

      assert.ok(
        found,
        assign
          ? `${seam.label} ya no declara \`export const ${assign} = ${literal}\`. Esa constante ` +
              `es la clave con la que se resuelve el módulo ${mod.folder}. Consecuencia de ` +
              `dejarla desalineada: ${seam.onDrift}.`
          : `${seam.label} (extensión "${seam.extension}") ya no contiene el literal ${literal}. ` +
              `Ese archivo se le entrega a proyectos de clientes SIN el módulo ${mod.folder}, así que ` +
              `NO puede importar ${mod.constant}: tiene que repetir el string. Consecuencia de ` +
              `dejarlo desalineado: ${seam.onDrift}.`
      );
    }
  });
}
