/**
 * Standalone, idempotent seed for the OWN-FLEET ("Flota Propia") USE CASES.
 *
 * Populates every moving part of the own-fleet engine so the cases can be seen
 * and exercised from the admin: vehicles, drivers + shifts, logistic zones,
 * zone↔resource assignments, dispatch rules and ONE refrigerated demo product.
 *
 * It is fully idempotent: every block looks up existing rows by a stable key
 * before creating, so re-running never duplicates anything.
 *
 * SCOPE NOTE — this script does NOT create the own-fleet SHIPPING OPTION. That
 * lives in `seed-own-fleet-shipping.ts` (F4) and must be run separately:
 *   pnpm exec medusa exec ./src/scripts/seed-own-fleet-shipping.ts
 * The shipping option is what makes checkout classify a fulfillment as
 * provider_type 'own_fleet'; this script seeds the FLEET the engine assigns to.
 *
 * Prerequisites (logged + skipped gracefully if missing):
 *  - At least one StoreLocation (run `pnpm seed:store-locations`). Vehicles,
 *    drivers and zones are anchored to a real store_location_id resolved at
 *    runtime — never hardcoded.
 *  - The demo products (run `pnpm db:seed`) — only needed for block 6
 *    (refrigerated product). Absent → warn and continue.
 *
 * Run with:
 *   pnpm seed:own-fleet
 *   or: dotenv -e .env -- medusa exec ./src/scripts/seed-own-fleet.ts
 */
import { updateProductVariantsWorkflow } from '@medusajs/core-flows';
import type {
  ExecArgs,
  IProductModuleService,
} from '@medusajs/framework/types';
import {
  ContainerRegistrationKeys,
  Modules,
} from '@medusajs/framework/utils';
import { DELIVERY_MODULE } from '../modules/delivery';
import type DeliveryModuleService from '../modules/delivery/service';
import { STORE_LOCATION_MODULE } from '../modules/store-location';
import type StoreLocationModuleService from '../modules/store-location/service';
import type {
  AssignStrategy,
  ResourceType,
  RulePredicate,
  RuleAction,
  TemperatureMode,
} from '../modules/delivery/types';

/* ── Static fixtures (typed against the real model fields / enums) ──────────*/

type VehicleSeed = {
  plate: string;
  name: string;
  type: 'motorcycle' | 'van' | 'truck' | 'car';
  max_orders: number;
  capacity_kg: number;
  capacity_m3?: number;
  has_refrigeration: boolean;
  temperature_modes: TemperatureMode[];
};

const VEHICLES: VehicleSeed[] = [
  {
    plate: 'MOTO01',
    name: 'Moto 01',
    type: 'motorcycle',
    max_orders: 8,
    capacity_kg: 15,
    has_refrigeration: false,
    temperature_modes: ['ambient'],
  },
  {
    plate: 'VANFRIO01',
    name: 'Van Frío 01',
    type: 'van',
    max_orders: 20,
    capacity_kg: 500,
    capacity_m3: 4,
    has_refrigeration: true,
    temperature_modes: ['ambient', 'refrigerated', 'frozen'],
  },
  {
    plate: 'AUTO01',
    name: 'Auto 01',
    type: 'car',
    max_orders: 12,
    capacity_kg: 200,
    has_refrigeration: false,
    temperature_modes: ['ambient'],
  },
];

type ShiftWindow = { day_of_week: number; start_time: string; end_time: string };

/** Mon–Fri (day_of_week 1..5) within the given window. */
const weekdayShifts = (start: string, end: string): ShiftWindow[] =>
  [1, 2, 3, 4, 5].map((day_of_week) => ({
    day_of_week,
    start_time: start,
    end_time: end,
  }));

type DriverSeed = {
  name: string;
  email: string;
  max_active_deliveries: number;
  shifts: ShiftWindow[];
};

const DRIVERS: DriverSeed[] = [
  {
    name: 'Juan Pérez',
    email: 'juan.perez@flota.mercatto.test',
    max_active_deliveries: 5,
    shifts: weekdayShifts('09:00', '18:00'),
  },
  {
    name: 'María López',
    email: 'maria.lopez@flota.mercatto.test',
    max_active_deliveries: 8,
    shifts: weekdayShifts('09:00', '18:00'),
  },
  {
    // Solo turno de tarde — para probar el filtro de turno del motor.
    name: 'Carlos Díaz',
    email: 'carlos.diaz@flota.mercatto.test',
    max_active_deliveries: 3,
    shifts: weekdayShifts('14:00', '18:00'),
  },
];

type ZoneSeed = {
  name: string;
  pricing_tier: string;
  enabled_providers: string[];
  default_assign_strategy: AssignStrategy;
};

const ZONES: ZoneSeed[] = [
  {
    name: 'Zona Urbana',
    pricing_tier: 'urbana',
    enabled_providers: ['own_fleet', 'andreani'],
    default_assign_strategy: 'least_load',
  },
  {
    name: 'Zona Extendida',
    pricing_tier: 'extendida',
    enabled_providers: ['own_fleet'],
    default_assign_strategy: 'round_robin',
  },
];

/** SKU del seed principal sobre el que marcamos temperatura 'refrigerated'. */
const REFRIGERATED_VARIANT_SKU = 'REMERA-S-NEGRO';
const REFRIGERATED_VALUE: TemperatureMode = 'refrigerated';

/* ── Helpers ────────────────────────────────────────────────────────────────*/

type RuleSeed = {
  name: string;
  /** 'zona-urbana' marca que la regla se cuelga de Zona Urbana; null = global. */
  zone: 'zona-urbana' | null;
  priority: number;
  conditions: RulePredicate[];
  action: RuleAction;
};

const RULES: RuleSeed[] = [
  {
    name: 'Flota propia para livianos',
    zone: null,
    priority: 50,
    conditions: [{ field: 'weight_kg', op: 'lte', value: 5000 }],
    action: { assign_provider: 'own_fleet', surcharge: 0 },
  },
  {
    name: 'Refrigerados manuales',
    zone: null,
    priority: 100,
    conditions: [
      { field: 'temperature', op: 'in', value: ['refrigerated', 'frozen'] },
    ],
    action: { route_strategy: 'manual' },
  },
  {
    name: 'Zona urbana round robin',
    zone: 'zona-urbana',
    priority: 10,
    conditions: [],
    action: { assign_strategy: 'round_robin', auto_assign: true },
  },
  {
    name: 'Tarde primer disponible',
    zone: null,
    priority: 20,
    conditions: [{ field: 'time_of_day', op: 'gte', value: '18:00' }],
    action: { assign_strategy: 'first_available' },
  },
];

/* ── Seed ───────────────────────────────────────────────────────────────────*/

export default async function seedOwnFleet({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  const delivery = container.resolve(DELIVERY_MODULE) as DeliveryModuleService;
  const storeLocationService = container.resolve(
    STORE_LOCATION_MODULE,
  ) as StoreLocationModuleService;
  const productService = container.resolve(
    Modules.PRODUCT,
  ) as IProductModuleService;

  logger.info('[seed-own-fleet] Seeding own-fleet use cases...');

  // ── 0. Resolve a REAL store_location_id at runtime ───────────────────────
  // Prefer "Casa Central — Buenos Aires" (from seed-store-locations); fall back
  // to the first active sucursal. Nothing is hardcoded.
  const [preferred] = await storeLocationService.listStoreLocations(
    { name: 'Casa Central — Buenos Aires' },
    { take: 1 },
  );
  let storeLocationId: string | null = preferred?.id ?? null;
  if (!storeLocationId) {
    const [anyLoc] = await storeLocationService.listStoreLocations(
      {},
      { take: 1 },
    );
    storeLocationId = anyLoc?.id ?? null;
  }

  if (!storeLocationId) {
    logger.warn(
      '[seed-own-fleet] No StoreLocation found — run `pnpm seed:store-locations` first. ' +
        'Aborting (fleet, zones and resources need a real sucursal).',
    );
    return;
  }
  logger.info(`[seed-own-fleet] Using store_location_id=${storeLocationId}`);

  const summary = {
    vehicles: { created: 0, skipped: 0 },
    drivers: { created: 0, skipped: 0 },
    shifts: { created: 0, skipped: 0 },
    zones: { created: 0, skipped: 0 },
    zoneResources: { created: 0, skipped: 0 },
    rules: { created: 0, skipped: 0 },
    product: { updated: 0, skipped: 0 },
  };

  // ── 1. Vehicles (idempotent by plate) ────────────────────────────────────
  const vehicleIdByName = new Map<string, string>();
  for (const v of VEHICLES) {
    const existing = (await delivery.listVehicles({ plate: v.plate })) as Array<{
      id: string;
    }>;
    if (existing[0]) {
      vehicleIdByName.set(v.name, existing[0].id);
      summary.vehicles.skipped += 1;
      logger.info(`[seed-own-fleet] Vehicle "${v.name}" (${v.plate}) exists — skip`);
      continue;
    }
    const created = (await delivery.createVehicles({
      plate: v.plate,
      type: v.type,
      max_orders: v.max_orders,
      capacity_kg: v.capacity_kg,
      capacity_m3: v.capacity_m3 ?? null,
      has_refrigeration: v.has_refrigeration,
      // model.json() columns are typed as Record<string,unknown> by the CRUD
      // factory; arrays are valid JSON at runtime, so we cast at the boundary.
      temperature_modes: v.temperature_modes as unknown as Record<string, unknown>,
      // Vehículo multi-sucursal: array de ids (el seed lo ancla a una sucursal).
      store_location_ids: [storeLocationId] as unknown as Record<string, unknown>,
      active: true,
      metadata: { display_name: v.name },
    })) as { id: string } | { id: string }[];
    const rec = Array.isArray(created) ? created[0] : created;
    if (rec) vehicleIdByName.set(v.name, rec.id);
    summary.vehicles.created += 1;
    logger.info(`[seed-own-fleet] Created vehicle "${v.name}" (${v.plate})`);
  }

  // ── 2. Drivers (idempotent by email) + shifts ────────────────────────────
  const driverIdByName = new Map<string, string>();
  for (const d of DRIVERS) {
    let driverId: string;
    const existing = (await delivery.listDrivers({ email: d.email })) as Array<{
      id: string;
    }>;
    if (existing[0]) {
      driverId = existing[0].id;
      summary.drivers.skipped += 1;
      logger.info(`[seed-own-fleet] Driver "${d.name}" exists — skip`);
    } else {
      const created = (await delivery.createDrivers({
        name: d.name,
        email: d.email,
        status: 'available',
        store_location_id: storeLocationId,
        max_active_deliveries: d.max_active_deliveries,
        active: true,
      })) as { id: string } | { id: string }[];
      const rec = Array.isArray(created) ? created[0] : created;
      driverId = rec!.id;
      summary.drivers.created += 1;
      logger.info(`[seed-own-fleet] Created driver "${d.name}"`);
    }
    driverIdByName.set(d.name, driverId);

    // Shifts — idempotent: skip the whole driver if it already has any shift.
    const existingShifts = (await delivery.listDriverShifts(
      { driver_id: driverId },
      { take: 1 },
    )) as unknown[];
    if (existingShifts.length > 0) {
      summary.shifts.skipped += d.shifts.length;
      logger.info(`[seed-own-fleet] Driver "${d.name}" already has shifts — skip`);
      continue;
    }
    await delivery.createDriverShifts(
      d.shifts.map((s) => ({
        driver_id: driverId,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        active: true,
      })),
    );
    summary.shifts.created += d.shifts.length;
    logger.info(
      `[seed-own-fleet] Created ${d.shifts.length} shift(s) for "${d.name}"`,
    );
  }

  // ── 3. Zones (idempotent by name) ─────────────────────────────────────────
  const zoneIdByName = new Map<string, string>();
  for (const z of ZONES) {
    const existing = (await delivery.listDeliveryZones({
      name: z.name,
    })) as Array<{ id: string }>;
    if (existing[0]) {
      zoneIdByName.set(z.name, existing[0].id);
      summary.zones.skipped += 1;
      logger.info(`[seed-own-fleet] Zone "${z.name}" exists — skip`);
      continue;
    }
    const created = (await delivery.createDeliveryZones({
      name: z.name,
      store_location_id: storeLocationId,
      pricing_tier: z.pricing_tier,
      // JSON column — see vehicle note above.
      enabled_providers: z.enabled_providers as unknown as Record<string, unknown>,
      active: true,
      metadata: { default_assign_strategy: z.default_assign_strategy },
    })) as { id: string } | { id: string }[];
    const rec = Array.isArray(created) ? created[0] : created;
    if (rec) zoneIdByName.set(z.name, rec.id);
    summary.zones.created += 1;
    logger.info(`[seed-own-fleet] Created zone "${z.name}"`);
  }

  // ── 4. ZoneResource — Van Frío 01 + Juan Pérez → Zona Urbana ──────────────
  // Zona Extendida queda SIN recursos (semántica "sin restricción de zona").
  const urbanaZoneId = zoneIdByName.get('Zona Urbana') ?? null;
  if (urbanaZoneId) {
    const mappings: { type: ResourceType; resourceId: string | undefined; label: string }[] = [
      {
        type: 'vehicle',
        resourceId: vehicleIdByName.get('Van Frío 01'),
        label: 'Van Frío 01',
      },
      {
        type: 'driver',
        resourceId: driverIdByName.get('Juan Pérez'),
        label: 'Juan Pérez',
      },
    ];
    for (const m of mappings) {
      if (!m.resourceId) {
        logger.warn(
          `[seed-own-fleet] Cannot map ${m.type} "${m.label}" — resource id missing`,
        );
        continue;
      }
      // Idempotent by the unique key (zone, resource_type, resource_id).
      const existing = (await delivery.listZoneResources({
        delivery_zone_id: urbanaZoneId,
        resource_type: m.type,
        resource_id: m.resourceId,
      })) as unknown[];
      if (existing.length > 0) {
        summary.zoneResources.skipped += 1;
        logger.info(`[seed-own-fleet] ZoneResource ${m.type} "${m.label}" exists — skip`);
        continue;
      }
      await delivery.createZoneResources({
        delivery_zone_id: urbanaZoneId,
        resource_type: m.type,
        resource_id: m.resourceId,
        active: true,
      });
      summary.zoneResources.created += 1;
      logger.info(`[seed-own-fleet] Mapped ${m.type} "${m.label}" → Zona Urbana`);
    }
  } else {
    logger.warn('[seed-own-fleet] Zona Urbana not resolved — skipping zone resources');
  }

  // ── 5. Rules (idempotent by name) ─────────────────────────────────────────
  for (const r of RULES) {
    const existing = (await delivery.listDeliveryRules({
      name: r.name,
    })) as Array<{ id: string }>;
    if (existing[0]) {
      summary.rules.skipped += 1;
      logger.info(`[seed-own-fleet] Rule "${r.name}" exists — skip`);
      continue;
    }
    const zoneId =
      r.zone === 'zona-urbana' ? (zoneIdByName.get('Zona Urbana') ?? null) : null;
    if (r.zone === 'zona-urbana' && !zoneId) {
      logger.warn(
        `[seed-own-fleet] Rule "${r.name}" needs Zona Urbana but it is missing — skip`,
      );
      summary.rules.skipped += 1;
      continue;
    }
    await delivery.createDeliveryRules({
      name: r.name,
      delivery_zone_id: zoneId,
      priority: r.priority,
      // conditions is a JSON array column — cast at the boundary (see above).
      conditions: r.conditions as unknown as Record<string, unknown>,
      action: r.action as unknown as Record<string, unknown>,
      active: true,
    });
    summary.rules.created += 1;
    logger.info(`[seed-own-fleet] Created rule "${r.name}"`);
  }

  // ── 6. Refrigerated demo product (idempotent by existing metadata) ────────
  // Reads temperature from native variant.metadata (never a custom column).
  const [variant] = (await productService.listProductVariants(
    { sku: REFRIGERATED_VARIANT_SKU },
    { select: ['id', 'sku', 'metadata'], take: 1 },
  )) as Array<{ id: string; metadata: Record<string, unknown> | null }>;

  if (!variant) {
    logger.warn(
      `[seed-own-fleet] Demo variant sku="${REFRIGERATED_VARIANT_SKU}" not found ` +
        '(run `pnpm db:seed`) — skipping refrigerated product.',
    );
    summary.product.skipped += 1;
  } else if (variant.metadata?.temperature) {
    summary.product.skipped += 1;
    logger.info(
      `[seed-own-fleet] Variant ${variant.id} already has temperature=` +
        `${String(variant.metadata.temperature)} — skip`,
    );
  } else {
    await updateProductVariantsWorkflow(container).run({
      input: {
        product_variants: [
          {
            id: variant.id,
            metadata: {
              ...(variant.metadata ?? {}),
              temperature: REFRIGERATED_VALUE,
            },
          },
        ],
      },
    });
    summary.product.updated += 1;
    logger.info(
      `[seed-own-fleet] Marked variant ${variant.id} (sku=${REFRIGERATED_VARIANT_SKU}) ` +
        `as temperature='${REFRIGERATED_VALUE}'`,
    );
  }

  // ── 7. Summary ────────────────────────────────────────────────────────────
  logger.info(
    '[seed-own-fleet] Done — ' +
      `vehicles ${summary.vehicles.created}/${summary.vehicles.skipped}, ` +
      `drivers ${summary.drivers.created}/${summary.drivers.skipped}, ` +
      `shifts ${summary.shifts.created}/${summary.shifts.skipped}, ` +
      `zones ${summary.zones.created}/${summary.zones.skipped}, ` +
      `zoneResources ${summary.zoneResources.created}/${summary.zoneResources.skipped}, ` +
      `rules ${summary.rules.created}/${summary.rules.skipped}, ` +
      `product ${summary.product.updated}/${summary.product.skipped} ` +
      '(created/skipped).',
  );
}
