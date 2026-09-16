/**
 * Demo store-locations seed (idempotent — looks up each location by name
 * before creating it, so it can be run multiple times).
 *
 * Run with:
 *   pnpm seed:store-locations
 *   or: dotenv -e .env -- medusa exec ./src/scripts/seed-store-locations.ts
 */
import type {
  ExecArgs,
  IStockLocationService,
} from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { STORE_LOCATION_MODULE } from '../modules/store-location';
import type StoreLocationModuleService from '../modules/store-location/service';

/**
 * Sucursales (por code) que despachan desde el "Main Warehouse" en la demo. Se
 * les setea stock_location_id para que el fallback nivel 2 de
 * create-delivery-execution (fulfillment.location_id → store_location vía
 * stock_location_id) matchee. CABA + GBA.
 */
const DISPATCHES_FROM_MAIN_WAREHOUSE = new Set<string>([
  'CC-BA', // Casa Central — Buenos Aires
  'SUC-PAL', // Palermo
  'SUC-BEL', // Belgrano
  'SUC-LP', // La Plata
  'MAY-LM', // Mayorista La Matanza
  'CD-PAC', // Centro de Distribución Pacheco
]);

type BusinessHoursEntry = {
  closed: boolean;
  is24Hours: boolean;
  slots: { open: string; close: string }[];
};
type BusinessHours = Record<string, BusinessHoursEntry>;

const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;
const WEEKDAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'] as const;

/** Mon–Fri open with the given slot, Sat/Sun closed (optionally Sat morning). */
const weekdayHours = (
  open = '09:00',
  close = '18:00',
  saturdayMorning = false,
): BusinessHours => {
  const hours: BusinessHours = {};
  for (const day of DAYS) {
    const isWeekday = (WEEKDAYS as readonly string[]).includes(day);
    if (isWeekday) {
      hours[day] = { closed: false, is24Hours: false, slots: [{ open, close }] };
    } else if (day === 'sabado' && saturdayMorning) {
      hours[day] = {
        closed: false,
        is24Hours: false,
        slots: [{ open: '09:00', close: '13:00' }],
      };
    } else {
      hours[day] = { closed: true, is24Hours: false, slots: [{ open, close }] };
    }
  }
  return hours;
};

const DEMO_LOCATIONS = [
  {
    name: 'Casa Central — Buenos Aires',
    store_type: 'point_of_sale',
    code: 'CC-BA',
    province: 'CABA',
    city: 'CABA',
    street: 'Av. Corrientes 1234',
    lat: '-34.6037',
    lng: '-58.3816',
    phone: '+54 11 4321-1000',
    whatsapp: '+54 9 11 4321-1000',
    email: 'casacentral@ejemplo.com.ar',
    business_hours: weekdayHours('09:00', '18:00'),
    is_visible: true,
  },
  {
    name: 'Sucursal Córdoba',
    store_type: 'point_of_sale',
    code: 'SUC-CBA',
    province: 'Córdoba',
    city: 'Córdoba',
    street: 'Av. Colón 850',
    lat: '-31.4135',
    lng: '-64.1936',
    phone: '+54 351 422-2000',
    whatsapp: '+54 9 351 422-2000',
    email: 'cordoba@ejemplo.com.ar',
    business_hours: weekdayHours('09:00', '18:00', true),
    is_visible: true,
  },
  {
    name: 'Centro de Distribución Pacheco',
    store_type: 'distribution_center',
    code: 'CD-PAC',
    province: 'Buenos Aires',
    city: 'General Pacheco',
    street: 'Ruta 197 km 3.5',
    lat: '-34.4605',
    lng: '-58.6334',
    phone: '+54 11 4740-3000',
    whatsapp: null,
    email: 'logistica@ejemplo.com.ar',
    business_hours: weekdayHours('08:00', '17:00'),
    is_visible: false,
  },
  {
    name: 'Mayorista Rosario',
    store_type: 'wholesale',
    code: 'MAY-ROS',
    province: 'Santa Fe',
    city: 'Rosario',
    street: 'Bv. Oroño 1500',
    lat: '-32.9468',
    lng: '-60.6393',
    phone: '+54 341 430-4000',
    whatsapp: '+54 9 341 430-4000',
    email: 'mayorista.rosario@ejemplo.com.ar',
    business_hours: weekdayHours('08:30', '17:30'),
    is_visible: true,
  },
  {
    name: 'Sucursal Palermo',
    store_type: 'point_of_sale',
    code: 'SUC-PAL',
    province: 'CABA',
    city: 'CABA',
    street: 'Av. Santa Fe 3500',
    lat: '-34.5889',
    lng: '-58.4306',
    phone: '+54 11 4823-1100',
    whatsapp: '+54 9 11 4823-1100',
    email: 'palermo@ejemplo.com.ar',
    business_hours: weekdayHours('10:00', '20:00', true),
    is_visible: true,
  },
  {
    name: 'Sucursal Belgrano',
    store_type: 'point_of_sale',
    code: 'SUC-BEL',
    province: 'CABA',
    city: 'CABA',
    street: 'Av. Cabildo 2200',
    lat: '-34.5627',
    lng: '-58.4566',
    phone: '+54 11 4781-1200',
    whatsapp: '+54 9 11 4781-1200',
    email: 'belgrano@ejemplo.com.ar',
    business_hours: weekdayHours('10:00', '20:00', true),
    is_visible: true,
  },
  {
    name: 'Sucursal La Plata',
    store_type: 'point_of_sale',
    code: 'SUC-LP',
    province: 'Buenos Aires',
    city: 'La Plata',
    street: 'Calle 8 N° 850',
    lat: '-34.9215',
    lng: '-57.9545',
    phone: '+54 221 423-1300',
    whatsapp: '+54 9 221 423-1300',
    email: 'laplata@ejemplo.com.ar',
    business_hours: weekdayHours('09:00', '18:00', true),
    is_visible: true,
  },
  {
    name: 'Sucursal Mar del Plata',
    store_type: 'point_of_sale',
    code: 'SUC-MDP',
    province: 'Buenos Aires',
    city: 'Mar del Plata',
    street: 'Av. Independencia 2500',
    lat: '-38.0055',
    lng: '-57.5426',
    phone: '+54 223 491-1400',
    whatsapp: '+54 9 223 491-1400',
    email: 'mardelplata@ejemplo.com.ar',
    business_hours: weekdayHours('09:00', '19:00', true),
    is_visible: true,
  },
  {
    name: 'Sucursal Bahía Blanca',
    store_type: 'point_of_sale',
    code: 'SUC-BB',
    province: 'Buenos Aires',
    city: 'Bahía Blanca',
    street: 'Av. Alem 900',
    lat: '-38.7183',
    lng: '-62.2663',
    phone: '+54 291 455-1500',
    whatsapp: '+54 9 291 455-1500',
    email: 'bahiablanca@ejemplo.com.ar',
    business_hours: weekdayHours('09:00', '18:00'),
    is_visible: true,
  },
  {
    name: 'Sucursal Mendoza',
    store_type: 'point_of_sale',
    code: 'SUC-MZA',
    province: 'Mendoza',
    city: 'Mendoza',
    street: 'Av. San Martín 1200',
    lat: '-32.8895',
    lng: '-68.8458',
    phone: '+54 261 423-1600',
    whatsapp: '+54 9 261 423-1600',
    email: 'mendoza@ejemplo.com.ar',
    business_hours: weekdayHours('09:00', '19:00', true),
    is_visible: true,
  },
  {
    name: 'Sucursal San Rafael',
    store_type: 'point_of_sale',
    code: 'SUC-SR',
    province: 'Mendoza',
    city: 'San Rafael',
    street: 'Av. Hipólito Yrigoyen 350',
    lat: '-34.6177',
    lng: '-68.3301',
    phone: '+54 260 442-1700',
    whatsapp: '+54 9 260 442-1700',
    email: 'sanrafael@ejemplo.com.ar',
    business_hours: weekdayHours('09:00', '18:00'),
    is_visible: true,
  },
  {
    name: 'Sucursal Tucumán',
    store_type: 'point_of_sale',
    code: 'SUC-TUC',
    province: 'Tucumán',
    city: 'San Miguel de Tucumán',
    street: 'Calle 25 de Mayo 500',
    lat: '-26.8083',
    lng: '-65.2176',
    phone: '+54 381 421-1800',
    whatsapp: '+54 9 381 421-1800',
    email: 'tucuman@ejemplo.com.ar',
    business_hours: weekdayHours('09:00', '18:00', true),
    is_visible: true,
  },
  {
    name: 'Sucursal Salta',
    store_type: 'point_of_sale',
    code: 'SUC-SAL',
    province: 'Salta',
    city: 'Salta',
    street: 'Calle Caseros 700',
    lat: '-24.7821',
    lng: '-65.4232',
    phone: '+54 387 431-1900',
    whatsapp: '+54 9 387 431-1900',
    email: 'salta@ejemplo.com.ar',
    business_hours: weekdayHours('09:00', '18:00'),
    is_visible: true,
  },
  {
    name: 'Sucursal Neuquén',
    store_type: 'point_of_sale',
    code: 'SUC-NQN',
    province: 'Neuquén',
    city: 'Neuquén',
    street: 'Av. Argentina 250',
    lat: '-38.9516',
    lng: '-68.0591',
    phone: '+54 299 442-2000',
    whatsapp: '+54 9 299 442-2000',
    email: 'neuquen@ejemplo.com.ar',
    business_hours: weekdayHours('09:00', '18:00'),
    is_visible: true,
  },
  {
    name: 'Sucursal Bariloche',
    store_type: 'point_of_sale',
    code: 'SUC-BRC',
    province: 'Río Negro',
    city: 'San Carlos de Bariloche',
    street: 'Calle Mitre 150',
    lat: '-41.1335',
    lng: '-71.3103',
    phone: '+54 294 442-2100',
    whatsapp: '+54 9 294 442-2100',
    email: 'bariloche@ejemplo.com.ar',
    business_hours: weekdayHours('10:00', '19:00', true),
    is_visible: true,
  },
  {
    name: 'Sucursal Santa Fe',
    store_type: 'point_of_sale',
    code: 'SUC-SF',
    province: 'Santa Fe',
    city: 'Santa Fe',
    street: 'Calle San Martín 2400',
    lat: '-31.6107',
    lng: '-60.6973',
    phone: '+54 342 455-2200',
    whatsapp: '+54 9 342 455-2200',
    email: 'santafe@ejemplo.com.ar',
    business_hours: weekdayHours('09:00', '18:00'),
    is_visible: true,
  },
  {
    name: 'Sucursal Paraná',
    store_type: 'point_of_sale',
    code: 'SUC-PAR',
    province: 'Entre Ríos',
    city: 'Paraná',
    street: 'Calle San Martín 800',
    lat: '-31.7319',
    lng: '-60.5238',
    phone: '+54 343 423-2300',
    whatsapp: '+54 9 343 423-2300',
    email: 'parana@ejemplo.com.ar',
    business_hours: weekdayHours('09:00', '18:00'),
    is_visible: true,
  },
  {
    name: 'Sucursal Corrientes',
    store_type: 'point_of_sale',
    code: 'SUC-CTE',
    province: 'Corrientes',
    city: 'Corrientes',
    street: 'Av. 3 de Abril 1100',
    lat: '-27.4692',
    lng: '-58.8306',
    phone: '+54 379 442-2400',
    whatsapp: '+54 9 379 442-2400',
    email: 'corrientes@ejemplo.com.ar',
    business_hours: weekdayHours('08:30', '17:30'),
    is_visible: true,
  },
  {
    name: 'Sucursal Resistencia',
    store_type: 'point_of_sale',
    code: 'SUC-RES',
    province: 'Chaco',
    city: 'Resistencia',
    street: 'Av. 9 de Julio 450',
    lat: '-27.4514',
    lng: '-58.9867',
    phone: '+54 362 442-2500',
    whatsapp: '+54 9 362 442-2500',
    email: 'resistencia@ejemplo.com.ar',
    business_hours: weekdayHours('08:30', '17:30'),
    is_visible: true,
  },
  {
    name: 'Sucursal Posadas',
    store_type: 'point_of_sale',
    code: 'SUC-POS',
    province: 'Misiones',
    city: 'Posadas',
    street: 'Av. Mitre 1600',
    lat: '-27.3621',
    lng: '-55.9007',
    phone: '+54 376 442-2600',
    whatsapp: '+54 9 376 442-2600',
    email: 'posadas@ejemplo.com.ar',
    business_hours: weekdayHours('08:30', '17:30'),
    is_visible: true,
  },
  {
    name: 'Sucursal San Juan',
    store_type: 'point_of_sale',
    code: 'SUC-SJ',
    province: 'San Juan',
    city: 'San Juan',
    street: 'Av. Libertador 950',
    lat: '-31.5375',
    lng: '-68.5364',
    phone: '+54 264 422-2700',
    whatsapp: '+54 9 264 422-2700',
    email: 'sanjuan@ejemplo.com.ar',
    business_hours: weekdayHours('09:00', '18:00'),
    is_visible: true,
  },
  {
    name: 'Sucursal Comodoro Rivadavia',
    store_type: 'point_of_sale',
    code: 'SUC-CR',
    province: 'Chubut',
    city: 'Comodoro Rivadavia',
    street: 'Av. Rivadavia 600',
    lat: '-45.8641',
    lng: '-67.4966',
    phone: '+54 297 444-2800',
    whatsapp: '+54 9 297 444-2800',
    email: 'comodoro@ejemplo.com.ar',
    business_hours: weekdayHours('09:00', '18:00'),
    is_visible: true,
  },
  {
    name: 'Mayorista La Matanza',
    store_type: 'wholesale',
    code: 'MAY-LM',
    province: 'Buenos Aires',
    city: 'San Justo',
    street: 'Av. Brigadier Juan Manuel de Rosas 4200',
    lat: '-34.6769',
    lng: '-58.5614',
    phone: '+54 11 4651-2900',
    whatsapp: '+54 9 11 4651-2900',
    email: 'mayorista.lamatanza@ejemplo.com.ar',
    business_hours: weekdayHours('08:00', '17:00', true),
    is_visible: true,
  },
  {
    name: 'Centro de Distribución Córdoba',
    store_type: 'distribution_center',
    code: 'CD-CBA',
    province: 'Córdoba',
    city: 'Córdoba',
    street: 'Av. Circunvalación 5000',
    lat: '-31.4201',
    lng: '-64.1888',
    phone: '+54 351 488-3000',
    whatsapp: null,
    email: 'logistica.cordoba@ejemplo.com.ar',
    business_hours: weekdayHours('08:00', '17:00'),
    is_visible: false,
  },
];

export default async function seedStoreLocations({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const service: StoreLocationModuleService = container.resolve(STORE_LOCATION_MODULE);

  let created = 0;
  let skipped = 0;

  for (const location of DEMO_LOCATIONS) {
    const existing = await service.listStoreLocations({ name: location.name });
    if (existing.length > 0) {
      logger.info(`[seed-store-locations] "${location.name}" already exists — skipping`);
      skipped += 1;
      continue;
    }

    await service.createStoreLocations(location);
    logger.info(`[seed-store-locations] Created "${location.name}"`);
    created += 1;
  }

  logger.info(`[seed-store-locations] Done — ${created} created, ${skipped} skipped`);

  // ── Linkeo sucursales ↔ stock location "Main Warehouse" (Opción B) ─────────
  // POSTERIOR a la creación: resolvemos el stock location y seteamos
  // stock_location_id SOLO donde está null (idempotente). Si "Main Warehouse"
  // no existe (seed principal no corrido), warning y seguimos.
  let stockLocationId: string | null = null;
  try {
    const stockLocationService = container.resolve<IStockLocationService>(
      Modules.STOCK_LOCATION,
    );
    const [warehouse] = await stockLocationService.listStockLocations(
      { name: 'Main Warehouse' },
      { take: 1 },
    );
    stockLocationId = warehouse?.id ?? null;
  } catch {
    stockLocationId = null;
  }

  if (!stockLocationId) {
    logger.warn(
      '[seed-store-locations] Stock location "Main Warehouse" no encontrado — ' +
        'run `pnpm db:seed` first. Skipping stock_location_id linking.',
    );
    return;
  }

  let linked = 0;
  let linkSkipped = 0;
  for (const location of DEMO_LOCATIONS) {
    if (!DISPATCHES_FROM_MAIN_WAREHOUSE.has(location.code)) continue;

    const [branch] = await service.listStoreLocations(
      { name: location.name },
      { take: 1 },
    );
    if (!branch) {
      linkSkipped += 1;
      continue;
    }
    if (branch.stock_location_id) {
      linkSkipped += 1;
      continue;
    }

    await service.updateStoreLocations({
      id: branch.id,
      stock_location_id: stockLocationId,
    });
    linked += 1;
    logger.info(
      `[seed-store-locations] Linked "${location.name}" → stock_location ${stockLocationId}`,
    );
  }

  logger.info(
    `[seed-store-locations] Stock linking done — ${linked} linked, ${linkSkipped} skipped`,
  );
}
