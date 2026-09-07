/**
 * seed-coverage — polígonos de cobertura (BranchCoverage) para sucursales de
 * CABA, + linkeo DeliveryZone → BranchCoverage. IDEMPOTENTE.
 *
 * Por qué existe: sin coverages seedeados, `resolveByPoint` siempre devuelve
 * null → las DeliveryExecution own_fleet quedan sin store_location_id /
 * delivery_zone_id y el auto-armado de rutas no las encuentra. Este seed crea las
 * geometrías mínimas para que la resolución punto→sucursal→zona funcione en demo.
 *
 * Formato del polígono (BranchCoverage.polygon): PolygonPoint[] =
 * [{ x: "<lng>", y: "<lat>" }] como STRINGS (x = lng, y = lat), anillo CERRADO
 * (último vértice = primero).
 *
 * Coberturas:
 *  - "Casa Central — Buenos Aires": rectángulo que cubre TODA la CABA
 *    (lat -34.53..-34.70, lng -58.53..-58.35), priority 0 (catch-all).
 *  - "Sucursal Palermo": polígono chico sobre Palermo, priority 10 (gana el
 *    desempate dentro de CABA).
 *  - "Sucursal Belgrano": polígono chico sobre Belgrano, priority 10.
 *
 * También linkea cada DeliveryZone a la cobertura de su sucursal vía
 * branch_coverage_id (solo si está null), para que resolveZone(branch_coverage_id)
 * encuentre la zona. Best-effort por nombre de sucursal/zona.
 *
 * Run with:
 *   pnpm seed:coverage
 *   or: dotenv -e .env -- medusa exec ./src/scripts/seed-coverage.ts
 *
 * Prereqs (logueados + saltados si faltan):
 *  - StoreLocations (run `pnpm seed:store-locations`).
 *  - DeliveryZones para el linkeo (run `pnpm seed:own-fleet`).
 */
import type { ExecArgs } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { STORE_LOCATION_MODULE } from '../modules/store-location';
import type StoreLocationModuleService from '../modules/store-location/service';
import { DELIVERY_MODULE } from '../modules/delivery';
import type DeliveryModuleService from '../modules/delivery/service';

/** Vértice de polígono: STRINGS, x = lng, y = lat (formato AEC). */
type PolyPoint = { x: string; y: string };

type CoverageSeed = {
  /** Nombre de la sucursal dueña (lookup por StoreLocation.name). */
  store_location_name: string;
  /** Nombre de la cobertura (clave de idempotencia). */
  name: string;
  priority: number;
  polygon: PolyPoint[];
};

/**
 * Rectángulo CABA (catch-all). Esquinas aproximadas de la ciudad:
 *   lat: -34.53 (norte) .. -34.70 (sur); lng: -58.53 (oeste) .. -58.35 (este).
 * Anillo cerrado en sentido horario; último = primero.
 */
const CABA_RECTANGLE: PolyPoint[] = [
  { x: '-58.53', y: '-34.53' }, // NO
  { x: '-58.35', y: '-34.53' }, // NE
  { x: '-58.35', y: '-34.70' }, // SE
  { x: '-58.53', y: '-34.70' }, // SO
  { x: '-58.53', y: '-34.53' }, // cierre
];

/** Polígono chico sobre Palermo (centro aprox -34.5889, -58.4306). */
const PALERMO_POLY: PolyPoint[] = [
  { x: '-58.4500', y: '-34.5700' },
  { x: '-58.4100', y: '-34.5700' },
  { x: '-58.4100', y: '-34.6050' },
  { x: '-58.4500', y: '-34.6050' },
  { x: '-58.4500', y: '-34.5700' },
];

/** Polígono chico sobre Belgrano (centro aprox -34.5627, -58.4566). */
const BELGRANO_POLY: PolyPoint[] = [
  { x: '-58.4750', y: '-34.5450' },
  { x: '-58.4350', y: '-34.5450' },
  { x: '-58.4350', y: '-34.5800' },
  { x: '-58.4750', y: '-34.5800' },
  { x: '-58.4750', y: '-34.5450' },
];

const COVERAGES: CoverageSeed[] = [
  {
    store_location_name: 'Casa Central — Buenos Aires',
    name: 'Cobertura CABA — Casa Central',
    priority: 0,
    polygon: CABA_RECTANGLE,
  },
  {
    store_location_name: 'Sucursal Palermo',
    name: 'Cobertura Palermo',
    priority: 10,
    polygon: PALERMO_POLY,
  },
  {
    store_location_name: 'Sucursal Belgrano',
    name: 'Cobertura Belgrano',
    priority: 10,
    polygon: BELGRANO_POLY,
  },
];

/**
 * Linkeo DeliveryZone → BranchCoverage. La zona se ancla a la sucursal dueña de
 * la cobertura (mapeo demo). Solo setea branch_coverage_id si está null.
 */
const ZONE_LINKS: { zone_name: string; coverage_name: string }[] = [
  { zone_name: 'Zona Urbana', coverage_name: 'Cobertura CABA — Casa Central' },
];

export default async function seedCoverage({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const storeLocation = container.resolve(
    STORE_LOCATION_MODULE,
  ) as StoreLocationModuleService;
  const delivery = container.resolve(DELIVERY_MODULE) as DeliveryModuleService;

  let created = 0;
  let skipped = 0;
  const coverageIdByName = new Map<string, string>();

  // ── 1. BranchCoverages (idempotente por name dentro de su store_location) ──
  for (const c of COVERAGES) {
    const [branch] = await storeLocation.listStoreLocations(
      { name: c.store_location_name },
      { take: 1 },
    );
    if (!branch) {
      logger.warn(
        `[seed-coverage] Sucursal "${c.store_location_name}" no existe — ` +
          'run `pnpm seed:store-locations` first. Skipping coverage "' +
          `${c.name}".`,
      );
      skipped += 1;
      continue;
    }

    const existing = await storeLocation.listBranchCoverages({
      store_location_id: branch.id,
      name: c.name,
    });
    if (existing.length > 0 && existing[0]) {
      coverageIdByName.set(c.name, existing[0].id);
      logger.info(`[seed-coverage] Coverage "${c.name}" exists — skip`);
      skipped += 1;
      continue;
    }

    const result = await storeLocation.createBranchCoverages({
      store_location_id: branch.id,
      name: c.name,
      // model.json() se tipa como Record<string,unknown>; un array es JSON
      // válido en runtime — cast en el borde.
      polygon: c.polygon as unknown as Record<string, unknown>,
      priority: c.priority,
      active: true,
    });
    const rec = Array.isArray(result) ? result[0] : result;
    if (rec) coverageIdByName.set(c.name, rec.id);
    created += 1;
    logger.info(
      `[seed-coverage] Created coverage "${c.name}" for "${c.store_location_name}" ` +
        `(priority ${c.priority})`,
    );
  }

  // ── 2. Linkeo DeliveryZone → BranchCoverage (solo si está null) ────────────
  let zonesLinked = 0;
  let zonesSkipped = 0;
  for (const link of ZONE_LINKS) {
    const coverageId = coverageIdByName.get(link.coverage_name);
    if (!coverageId) {
      logger.warn(
        `[seed-coverage] Coverage "${link.coverage_name}" no resuelta — ` +
          `no se puede linkear zona "${link.zone_name}".`,
      );
      zonesSkipped += 1;
      continue;
    }

    const [zone] = (await delivery.listDeliveryZones({
      name: link.zone_name,
    })) as Array<{ id: string; branch_coverage_id: string | null }>;
    if (!zone) {
      logger.warn(
        `[seed-coverage] Zona "${link.zone_name}" no existe — ` +
          'run `pnpm seed:own-fleet` first. Skipping link.',
      );
      zonesSkipped += 1;
      continue;
    }

    if (zone.branch_coverage_id) {
      logger.info(
        `[seed-coverage] Zona "${link.zone_name}" ya linkeada ` +
          `(branch_coverage_id=${zone.branch_coverage_id}) — skip`,
      );
      zonesSkipped += 1;
      continue;
    }

    await delivery.updateDeliveryZones({
      id: zone.id,
      branch_coverage_id: coverageId,
    });
    zonesLinked += 1;
    logger.info(
      `[seed-coverage] Zona "${link.zone_name}" → coverage "${link.coverage_name}"`,
    );
  }

  logger.info(
    `[seed-coverage] Done — coverages ${created} created / ${skipped} skipped, ` +
      `zones ${zonesLinked} linked / ${zonesSkipped} skipped.`,
  );
}
