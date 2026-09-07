/**
 * SMOKE-TEST de SOLO LECTURA del entorno de FLOTA PROPIA del módulo delivery.
 *
 * Verifica, eslabón por eslabón, que un deploy quedó BIEN CONFIGURADO para operar
 * flota propia: migraciones aplicadas, flags de entorno, shipping option, flota
 * (vehículos + repartidores + turnos), zonas/reglas/recursos, coberturas
 * (polígonos), el link sucursal↔stock location, la resolución geográfica
 * (resolveByPoint), los helpers geo (extractLatLng), el geocoding de respaldo y
 * el estado de las ejecuciones own_fleet existentes.
 *
 * NO MUTA NADA. Solo list/retrieve/resolveByPoint/extractLatLng/geocodeAddress y
 * cómputo en memoria. Cada chequeo va en su propio try/catch: si uno falla, se
 * marca ✗ con el error y el script SIGUE con los demás (nunca aborta todo).
 *
 * Al final imprime un RESUMEN "N/M checks OK" y, si hubo ✗, una lista de
 * "Acciones sugeridas" mapeando cada falla a su fix.
 *
 * Run with:
 *   pnpm exec medusa exec ./src/scripts/smoke-test-delivery.ts
 *   or: dotenv -e .env -- medusa exec ./src/scripts/smoke-test-delivery.ts
 */
import type {
  ExecArgs,
  IFulfillmentModuleService,
} from '@medusajs/framework/types';
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
} from '@medusajs/framework/utils';
import { DELIVERY_MODULE } from '../modules/delivery';
import type DeliveryModuleService from '../modules/delivery/service';
import { STORE_LOCATION_MODULE } from '../modules/store-location';
import type StoreLocationModuleService from '../modules/store-location/service';
import { extractLatLng } from '../modules/delivery/geo';
import { geocodeAddress } from '../modules/delivery/geocoding';
import { getDeliverySettings } from '../modules/delivery/settings';

/* ── Tipos del reporte ──────────────────────────────────────────────────────*/

type CheckStatus = 'ok' | 'fail' | 'warn' | 'skip';

interface CheckResult {
  /** Etiqueta corta del eslabón (para el log y el resumen). */
  label: string;
  status: CheckStatus;
  /** Detalle conciso de qué se encontró / qué falló. */
  detail: string;
  /** Acción sugerida para resolver un ✗ (solo se usa en el resumen si fail). */
  fix?: string;
}

const PREFIX: Record<CheckStatus, string> = {
  ok: '✓',
  fail: '✗',
  warn: '⚠',
  skip: '·',
};

/** Punto conocido de CABA (Obelisco / centro) para probar resolveByPoint. */
const CABA_POINT = { lat: -34.6037, lng: -58.3816 };

// "Común" (Envío Estándar) ya es flota propia: classify() lo cae a own_fleet por
// default. La opción separada "Flota Propia Mercatto" fue eliminada (redundante).
const SHIPPING_OPTION_NAME = 'Envío Estándar';

/* ── Helpers de conteo defensivos ────────────────────────────────────────────*/

const count = (rows: unknown): number => (Array.isArray(rows) ? rows.length : 0);

const countWhere = <T,>(
  rows: unknown,
  pred: (row: T) => boolean,
): number => (Array.isArray(rows) ? (rows as T[]).filter(pred).length : 0);

const errMessage = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

/* ── Smoke test ───────────────────────────────────────────────────────────────*/

export default async function smokeTestDelivery({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  const delivery = container.resolve(DELIVERY_MODULE) as DeliveryModuleService;
  const storeLocation = container.resolve(
    STORE_LOCATION_MODULE,
  ) as StoreLocationModuleService;
  const fulfillment: IFulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT,
  );

  const results: CheckResult[] = [];
  const add = (r: CheckResult) => results.push(r);

  /**
   * Corre un chequeo aislado: cualquier excepción se convierte en ✗ con el
   * mensaje del error + el fix sugerido, sin tumbar el resto del smoke test.
   */
  const runCheck = async (
    label: string,
    fixOnError: string,
    fn: () => Promise<CheckResult>,
  ): Promise<void> => {
    try {
      add(await fn());
    } catch (e) {
      add({
        label,
        status: 'fail',
        detail: `error inesperado: ${errMessage(e)}`,
        fix: fixOnError,
      });
    }
  };

  logger.info('================================================================');
  logger.info('SMOKE-TEST FLOTA PROPIA (delivery) — SOLO LECTURA, no muta nada');
  logger.info('================================================================');

  /* 1. Tablas / migraciones — las entidades responden. ----------------------*/
  await runCheck(
    'Migraciones',
    'Correr `pnpm exec medusa db:migrate` (migraciones del módulo delivery pendientes)',
    async () => {
      await delivery.listDeliveryExecutions({}, { take: 1 });
      return {
        label: 'Migraciones',
        status: 'ok',
        detail: 'las entidades del módulo delivery responden (listDeliveryExecutions OK)',
      };
    },
  );

  /* 2. Configuración efectiva de delivery. -----------------------------------
   *
   * Se lee del resolver de `app-settings` (DB > env > default) y NO de
   * `process.env` como antes. Es la diferencia entre un smoke-test que dice la
   * verdad y uno que reporta "falta la key" cuando en realidad está guardada en
   * la card del admin: lo que importa acá es el valor EFECTIVO, que es el mismo
   * que va a usar el subscriber en producción.
   */
  const deliverySettings = getDeliverySettings();

  /* 2a. Auto-fulfillment de flota propia. -----------------------------------*/
  const AUTO_FULFILL_FIX =
    'Prender Delivery → Operación → "Auto-fulfillment de flota propia", o setear ' +
    'OWN_FLEET_AUTO_FULFILL=true en el entorno del backend';
  await runCheck('Flag OWN_FLEET_AUTO_FULFILL', AUTO_FULFILL_FIX, async () => {
    const enabled = deliverySettings.ownFleetAutoFulfill;
    return {
      label: 'Flag OWN_FLEET_AUTO_FULFILL',
      status: enabled ? 'ok' : 'fail',
      detail: enabled ? 'habilitado' : 'deshabilitado (las compras no entran a Delivery)',
      fix: enabled ? undefined : AUTO_FULFILL_FIX,
    };
  });

  /* 2b. API key de Google Maps presente (NO imprimir la key). ---------------*/
  const hasMapsKey = deliverySettings.googleMapsApiKey.length > 0;
  const MAPS_KEY_FIX =
    'Cargar la API key en Delivery → Credenciales, o setear GOOGLE_MAPS_API_KEY ' +
    'en el entorno (con Geocoding API habilitada), si querés geocoding de respaldo';
  await runCheck('GOOGLE_MAPS_API_KEY', MAPS_KEY_FIX, async () => ({
    label: 'GOOGLE_MAPS_API_KEY',
    status: hasMapsKey ? 'ok' : 'warn',
    detail: hasMapsKey
      ? 'configurada (geocoding de respaldo disponible)'
      : 'NO configurada — el geocoding de respaldo queda deshabilitado',
    fix: hasMapsKey ? undefined : MAPS_KEY_FIX,
  }));

  /* 3. Shipping option de flota propia (Común/Estándar) existe. --------------*/
  await runCheck(
    'Shipping option flota propia',
    'Correr el seed principal (`pnpm db:seed`) para crear los métodos Común/Express',
    async () => {
      const opts = await fulfillment.listShippingOptions({
        name: SHIPPING_OPTION_NAME,
      });
      const found = count(opts) > 0;
      return {
        label: 'Shipping option flota propia',
        status: found ? 'ok' : 'fail',
        detail: found
          ? `existe la opción "${SHIPPING_OPTION_NAME}" (flota propia por default)`
          : `no existe la opción "${SHIPPING_OPTION_NAME}"`,
        fix: found
          ? undefined
          : 'Correr el seed principal (`pnpm db:seed`) para crear los métodos Común/Express',
      };
    },
  );

  /* 4. Vehículos activos. ---------------------------------------------------*/
  await runCheck(
    'Vehículos',
    'Correr `pnpm seed:own-fleet` (no hay vehículos activos)',
    async () => {
      const vehicles = (await delivery.listVehicles({ active: true })) as Array<
        Record<string, unknown>
      >;
      const total = count(vehicles);
      const withRefri = countWhere<Record<string, unknown>>(
        vehicles,
        (v) => Boolean(v.has_refrigeration),
      );
      const withStore = countWhere<Record<string, unknown>>(
        vehicles,
        (v) =>
          Array.isArray(v.store_location_ids) &&
          (v.store_location_ids as unknown[]).length > 0,
      );
      return {
        label: 'Vehículos',
        status: total >= 1 ? 'ok' : 'fail',
        detail:
          total >= 1
            ? `${total} activo(s); ${withRefri} con refrigeración; ${withStore} con sucursal(es)`
            : '0 vehículos activos',
        fix: total >= 1 ? undefined : 'Correr `pnpm seed:own-fleet` para cargar la flota',
      };
    },
  );

  /* 5. Repartidores activos + turnos. ---------------------------------------*/
  await runCheck(
    'Repartidores',
    'Correr `pnpm seed:own-fleet` (no hay repartidores activos)',
    async () => {
      const drivers = (await delivery.listDrivers({ active: true })) as Array<
        Record<string, unknown>
      >;
      const total = count(drivers);
      const withMax = countWhere<Record<string, unknown>>(
        drivers,
        (d) => d.max_active_deliveries != null,
      );

      // Cuántos drivers tienen al menos un DriverShift (solo si hay drivers).
      let withShift = 0;
      if (total >= 1) {
        const driverIds = (drivers as Array<{ id?: unknown }>)
          .map((d) => (typeof d.id === 'string' ? d.id : null))
          .filter((id): id is string => Boolean(id));
        if (driverIds.length > 0) {
          const shifts = (await delivery.listDriverShifts({
            driver_id: driverIds,
          })) as Array<{ driver_id?: unknown }>;
          const withShiftSet = new Set(
            (Array.isArray(shifts) ? shifts : [])
              .map((s) => (typeof s.driver_id === 'string' ? s.driver_id : null))
              .filter((id): id is string => Boolean(id)),
          );
          withShift = withShiftSet.size;
        }
      }

      return {
        label: 'Repartidores',
        status: total >= 1 ? 'ok' : 'fail',
        detail:
          total >= 1
            ? `${total} activo(s); ${withMax} con max_active_deliveries; ${withShift} con al menos un turno`
            : '0 repartidores activos',
        fix: total >= 1 ? undefined : 'Correr `pnpm seed:own-fleet` para cargar repartidores y turnos',
      };
    },
  );

  /* 6. Zonas activas + cuántas con branch_coverage_id. ----------------------*/
  await runCheck(
    'Zonas',
    'Correr `pnpm seed:own-fleet` (no hay zonas activas)',
    async () => {
      const zones = (await delivery.listDeliveryZones({ active: true })) as Array<
        Record<string, unknown>
      >;
      const total = count(zones);
      const withCoverage = countWhere<Record<string, unknown>>(
        zones,
        (z) => typeof z.branch_coverage_id === 'string' && z.branch_coverage_id.length > 0,
      );
      return {
        label: 'Zonas',
        status: total >= 1 ? 'ok' : 'fail',
        detail:
          total >= 1
            ? `${total} activa(s); ${withCoverage} con branch_coverage_id linkeado`
            : '0 zonas activas',
        fix: total >= 1 ? undefined : 'Correr `pnpm seed:own-fleet` para cargar zonas logísticas',
      };
    },
  );

  /* 7. Reglas activas (informativo). ----------------------------------------*/
  await runCheck(
    'Reglas',
    'Correr `pnpm seed:own-fleet` si esperabas reglas de despacho',
    async () => {
      const rules = await delivery.listDeliveryRules({ active: true });
      const total = count(rules);
      return {
        label: 'Reglas',
        status: total >= 1 ? 'ok' : 'warn',
        detail:
          total >= 1
            ? `${total} regla(s) de despacho activa(s)`
            : '0 reglas activas (el caller mantiene su clasificación previa)',
      };
    },
  );

  /* 8. Recursos por zona (ZoneResource) — informativo. ----------------------*/
  await runCheck(
    'Recursos por zona',
    '',
    async () => {
      const zoneResources = await delivery.listZoneResources({});
      const total = count(zoneResources);
      return {
        label: 'Recursos por zona',
        status: 'ok',
        detail:
          total >= 1
            ? `${total} asignación(es) zona↔recurso (informativo)`
            : '0 asignaciones zona↔recurso (sin restricción de zona por recurso)',
      };
    },
  );

  /* 9. Coberturas (polígonos) activas. --------------------------------------*/
  await runCheck(
    'Coberturas (polígonos)',
    'Correr `pnpm seed:coverage` (sin coberturas activas, resolveByPoint nunca resuelve)',
    async () => {
      const coverages = await storeLocation.listBranchCoverages({ active: true });
      const total = count(coverages);
      return {
        label: 'Coberturas (polígonos)',
        status: total >= 1 ? 'ok' : 'fail',
        detail:
          total >= 1
            ? `${total} cobertura(s) activa(s)`
            : '0 coberturas activas — resolveByPoint nunca resolvería',
        fix: total >= 1 ? undefined : 'Correr `pnpm seed:coverage` para cargar los polígonos de cobertura',
      };
    },
  );

  /* 10. Sucursales ↔ stock location. ----------------------------------------*/
  await runCheck(
    'Sucursales ↔ stock location',
    'Linkear cada StoreLocation con su stock_location_id (run `pnpm seed:store-locations`)',
    async () => {
      const branches = (await storeLocation.listStoreLocations({})) as Array<
        Record<string, unknown>
      >;
      const total = count(branches);
      const withStock = countWhere<Record<string, unknown>>(
        branches,
        (b) => typeof b.stock_location_id === 'string' && b.stock_location_id.length > 0,
      );
      return {
        label: 'Sucursales ↔ stock location',
        status: withStock >= 1 ? 'ok' : 'fail',
        detail:
          withStock >= 1
            ? `${withStock}/${total} sucursal(es) con stock_location_id seteado`
            : `0/${total} sucursales con stock_location_id (fallback nivel 2 muerto)`,
        fix:
          withStock >= 1
            ? undefined
            : 'Linkear cada StoreLocation con su stock_location_id (run `pnpm seed:store-locations`)',
      };
    },
  );

  /* 11. Resolución geográfica (resolveByPoint) con punto de CABA. -----------*/
  await runCheck(
    'Resolución geográfica (resolveByPoint)',
    'Verificar coberturas (`pnpm seed:coverage`) que cubran el área operativa',
    async () => {
      const resolution = await storeLocation.resolveByPoint(CABA_POINT);
      if (!resolution) {
        return {
          label: 'Resolución geográfica (resolveByPoint)',
          status: 'fail',
          detail: `el punto CABA (${CABA_POINT.lat}, ${CABA_POINT.lng}) NO resolvió a ninguna sucursal`,
          fix: 'Verificar coberturas (`pnpm seed:coverage`) que cubran el área operativa de CABA',
        };
      }
      // Resolver el name de la sucursal por store_location_id (read-only).
      let branchName = resolution.store_location_id;
      try {
        const branch = (await storeLocation.retrieveStoreLocation(
          resolution.store_location_id,
        )) as { name?: unknown };
        if (typeof branch?.name === 'string' && branch.name.length > 0) {
          branchName = branch.name;
        }
      } catch {
        // Si no se puede resolver el name, dejamos el id; no es un fallo del check.
      }
      return {
        label: 'Resolución geográfica (resolveByPoint)',
        status: 'ok',
        detail: `punto CABA → sucursal "${branchName}" (match_type=${resolution.match_type}, coverage="${resolution.coverage_name}")`,
      };
    },
  );

  /* 12. extractLatLng — normaliza ambas formas de claves. -------------------*/
  await runCheck(
    'extractLatLng',
    'Revisar src/modules/delivery/geo.ts (extractLatLng no normaliza)',
    async () => {
      const a = extractLatLng({ latitude: '-34.6', longitude: '-58.4' });
      const b = extractLatLng({ lat: -34.6, lng: -58.4 });
      const ok = a !== null && b !== null;
      return {
        label: 'extractLatLng',
        status: ok ? 'ok' : 'fail',
        detail: ok
          ? 'normaliza { latitude, longitude } (string) y { lat, lng } (number) → no-null'
          : `falló: latitude/longitude=${JSON.stringify(a)}, lat/lng=${JSON.stringify(b)}`,
        fix: ok ? undefined : 'Revisar src/modules/delivery/geo.ts (extractLatLng no normaliza)',
      };
    },
  );

  /* 13. Geocoding de respaldo (solo si hay key). ----------------------------*/
  await runCheck(
    'Geocoding',
    'Habilitar la "Geocoding API" en el proyecto de Google Cloud de la key',
    async () => {
      if (!hasMapsKey) {
        return {
          label: 'Geocoding',
          status: 'skip',
          detail: 'SKIP (sin GOOGLE_MAPS_API_KEY)',
        };
      }
      const coords = await geocodeAddress(
        {
          address_1: 'Av. Corrientes 1234',
          city: 'CABA',
          province: 'Buenos Aires',
          country_code: 'ar',
        },
        { logger: { warn: (m) => logger.warn(`[smoke-test][geocoding] ${m}`) } },
      );
      const ok = coords !== null;
      return {
        label: 'Geocoding',
        status: ok ? 'ok' : 'warn',
        detail: ok
          ? `devolvió coords para "Av. Corrientes 1234, CABA" (lat=${coords!.lat}, lng=${coords!.lng})`
          : 'devolvió null — key inválida o "Geocoding API" no habilitada',
        fix: ok
          ? undefined
          : 'Habilitar la "Geocoding API" en el proyecto de Google Cloud de la key (o revisar la key)',
      };
    },
  );

  /* 14. Ejecuciones own_fleet existentes — informativo. ---------------------*/
  await runCheck(
    'Ejecuciones own_fleet',
    '',
    async () => {
      const executions = (await delivery.listDeliveryExecutions({
        provider_type: 'own_fleet',
      })) as Array<Record<string, unknown>>;
      const total = count(executions);
      const withStore = countWhere<Record<string, unknown>>(
        executions,
        (e) => typeof e.store_location_id === 'string' && e.store_location_id.length > 0,
      );
      const withoutRoute = countWhere<Record<string, unknown>>(
        executions,
        (e) => e.route_id == null,
      );
      return {
        label: 'Ejecuciones own_fleet',
        status: 'ok',
        detail:
          total >= 1
            ? `${total} ejecución(es) own_fleet; ${withStore} con store_location_id resuelto; ${withoutRoute} sin ruta (candidatas a auto-armar)`
            : '0 ejecuciones own_fleet (todavía no hubo pedidos de flota propia)',
      };
    },
  );

  /* ── Reporte línea por línea ───────────────────────────────────────────────*/

  logger.info('----------------------------------------------------------------');
  logger.info('CHECKLIST');
  logger.info('----------------------------------------------------------------');
  for (const r of results) {
    logger.info(`${PREFIX[r.status]} ${r.label}: ${r.detail}`);
  }

  /* ── Resumen ───────────────────────────────────────────────────────────────*/

  // ✗ cuenta como falla; warn/skip NO bajan el "N/M checks OK" (son informativos
  // / opcionales), pero los warn se listan aparte para que se vean.
  const failures = results.filter((r) => r.status === 'fail');
  const warnings = results.filter((r) => r.status === 'warn');
  const okCount = results.filter((r) => r.status === 'ok').length;
  const considered = results.filter(
    (r) => r.status === 'ok' || r.status === 'fail',
  ).length;

  logger.info('----------------------------------------------------------------');
  logger.info('RESUMEN');
  logger.info('----------------------------------------------------------------');
  logger.info(`${okCount}/${considered} checks OK`);

  if (warnings.length > 0) {
    logger.info(`Advertencias (${warnings.length}):`);
    for (const w of warnings) {
      logger.info(`  ⚠ ${w.label}: ${w.detail}`);
    }
  }

  if (failures.length > 0) {
    logger.info(`Fallas (${failures.length}) — acciones sugeridas:`);
    for (const f of failures) {
      logger.info(`  ✗ ${f.label}: ${f.fix ?? f.detail}`);
    }
    logger.info(
      'El entorno de flota propia NO está completamente configurado (ver acciones arriba).',
    );
  } else {
    logger.info('Entorno de flota propia OK — todos los eslabones críticos pasaron.');
  }
}
