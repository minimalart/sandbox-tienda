import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCorreoAgencyOperational,
  parseAgencyDayHours,
  transformCorreoAgencies,
  transformCorreoAgency,
} from './agencies.ts';
import sampleAgencies from './__fixtures__/agencies-sample.json' with { type: 'json' };
import type { CorreoRawAgency } from '../types.ts';

/** Ejemplo del manual: con TODOS los campos opcionales en null. */
const officialExample: CorreoRawAgency = {
  location: {
    geolocation: { latitude: -34.6037, longitude: -58.3816 },
    country_name: 'Argentina',
    state_name: 'Ciudad Autónoma de Buenos Aires',
    city_name: 'San Cristobal',
    city_id: '1234',
    neighborhood_name: 'San Cristobal',
    street_name: 'Av. Independencia',
    street_number: '2450',
    zip_code: '1225',
  },
  status: 'ACTIVE',
  schedule: 'LUN A VIE 08.00 A 14.30',
  owner: 'Correo Oficial de la República Argentina',
  email: 'scq@correoargentino.com.ar',
  phone: '011 4000-0000',
  agency_id: 'SCQ',
  agency_name: 'Sucursal San Cristobal',
  package_reception: true,
  pickup_availability: true,
  open_hours: null,
  last_updated: '2026-01-14',
  deactivation_date: null,
  volumetric_capacity: null,
  maximum_package_dimensions: null,
};

describe('transformCorreoAgency — ejemplo oficial', () => {
  it('mapea al shape que consume el storefront', () => {
    const agency = transformCorreoAgency(officialExample);

    assert.equal(agency.id, 'SCQ');
    assert.equal(agency.code, 'SCQ');
    assert.equal(agency.name, 'Sucursal San Cristobal');
    assert.equal(agency.service_type, 'agency');
    assert.equal(agency.status, 'ACTIVE');
    assert.equal(agency.schedule, 'LUN A VIE 08.00 A 14.30');
    assert.equal(agency.package_reception, true);
    assert.equal(agency.pickup_availability, true);

    assert.deepEqual(agency.address, {
      street: 'Av. Independencia',
      number: '2450',
      neighborhood: 'San Cristobal',
      city: 'San Cristobal',
      province: 'Ciudad Autónoma de Buenos Aires',
      province_code: 'C',
      postal_code: '1225',
      country: 'Argentina',
    });

    assert.deepEqual(agency.coordinates, {
      latitude: -34.6037,
      longitude: -58.3816,
    });
    assert.deepEqual(agency.contact_info, {
      phone: '011 4000-0000',
      email: 'scq@correoargentino.com.ar',
      owner: 'Correo Oficial de la República Argentina',
    });
  });

  it('resuelve el código de provincia de una letra, para reusarlo en POST /orders', () => {
    assert.equal(transformCorreoAgency(officialExample).address.province_code, 'C');
  });

  it('los opcionales que vienen null quedan null / vacíos, sin romper', () => {
    const agency = transformCorreoAgency(officialExample);
    assert.equal(agency.volumetric_capacity, null);
    assert.equal(agency.max_package_dimensions, null);
    assert.deepEqual(agency.operating_hours, []);
    assert.equal(agency.deactivation_date, null);
  });
});

describe('transformCorreoAgency — tolerancia', () => {
  it('un objeto vacío no rompe', () => {
    const agency = transformCorreoAgency({});
    assert.equal(agency.id, '');
    assert.equal(agency.coordinates, null);
    assert.equal(agency.package_reception, false);
    assert.equal(agency.pickup_availability, false);
    assert.deepEqual(agency.operating_hours, []);
  });

  it('street_number y zip_code numéricos se stringifican', () => {
    const agency = transformCorreoAgency({
      location: { street_number: 2450, zip_code: 1225 },
    });
    assert.equal(agency.address.number, '2450');
    assert.equal(agency.address.postal_code, '1225');
  });

  it('normaliza un CPA en zip_code', () => {
    const agency = transformCorreoAgency({
      location: { zip_code: 'C1225AAF' },
    });
    assert.equal(agency.address.postal_code, '1225');
  });

  it('una coordenada incompleta no produce un punto a medias', () => {
    assert.equal(
      transformCorreoAgency({ location: { geolocation: { latitude: -34.6 } } })
        .coordinates,
      null,
    );
  });

  it('sin agency_name usa el agency_id', () => {
    assert.equal(transformCorreoAgency({ agency_id: 'SCQ' }).name, 'SCQ');
  });

  it('una provincia que no se puede resolver deja province_code en null sin perder el nombre', () => {
    const agency = transformCorreoAgency({
      location: { state_name: 'Provincia Inventada' },
    });
    assert.equal(agency.address.province, 'Provincia Inventada');
    assert.equal(agency.address.province_code, null);
  });

  it('maximum_package_dimensions parcial completa con null', () => {
    const agency = transformCorreoAgency({
      maximum_package_dimensions: { height: 150, width: '80' },
    });
    assert.deepEqual(agency.max_package_dimensions, {
      height: 150,
      length: null,
      width: 80,
      weight: null,
    });
  });
});

describe('transformCorreoAgencies', () => {
  it('descarta entradas que no son objetos', () => {
    const agencies = transformCorreoAgencies([
      officialExample,
      null as unknown as CorreoRawAgency,
      'nope' as unknown as CorreoRawAgency,
    ]);
    assert.equal(agencies.length, 1);
  });

  it('una lista vacía o ausente devuelve []', () => {
    assert.deepEqual(transformCorreoAgencies([]), []);
    assert.deepEqual(
      transformCorreoAgencies(undefined as unknown as CorreoRawAgency[]),
      [],
    );
  });
});

describe('parseAgencyDayHours — el formato de open_hours no está documentado', () => {
  it('null → día cerrado', () => {
    assert.deepEqual(parseAgencyDayHours('monday', null), {
      day: 'monday',
      open_time: null,
      close_time: null,
      is_closed: true,
    });
  });

  it('formato con dos puntos', () => {
    assert.deepEqual(parseAgencyDayHours('monday', '08:00-14:30'), {
      day: 'monday',
      open_time: '08:00',
      close_time: '14:30',
      is_closed: false,
    });
  });

  it('formato con puntos, como el schedule humano', () => {
    assert.deepEqual(parseAgencyDayHours('monday', '08.00 A 14.30'), {
      day: 'monday',
      open_time: '08:00',
      close_time: '14:30',
      is_closed: false,
    });
  });

  it('formato objeto { open, close }', () => {
    assert.deepEqual(
      parseAgencyDayHours('monday', { open: '08:00', close: '14:30' }),
      {
        day: 'monday',
        open_time: '08:00',
        close_time: '14:30',
        is_closed: false,
      },
    );
  });

  it('"cerrado" → día cerrado', () => {
    assert.equal(parseAgencyDayHours('sunday', 'cerrado').is_closed, true);
    assert.equal(parseAgencyDayHours('sunday', 'Closed').is_closed, true);
  });

  it('un texto sin horas legibles no inventa horarios', () => {
    const parsed = parseAgencyDayHours('monday', 'a confirmar');
    assert.equal(parsed.open_time, null);
    assert.equal(parsed.close_time, null);
  });

  it('solo se emiten los días que Correo devolvió', () => {
    const agency = transformCorreoAgency({
      open_hours: { monday: '08:00-14:30', sunday: null },
    });
    assert.deepEqual(
      agency.operating_hours.map((entry) => entry.day),
      ['monday', 'sunday'],
    );
  });
});

describe('isCorreoAgencyOperational', () => {
  it('la sucursal del ejemplo es operativa', () => {
    assert.equal(
      isCorreoAgencyOperational(transformCorreoAgency(officialExample)),
      true,
    );
  });

  it('sin agency_id no sirve: no se puede dar de alta el envío', () => {
    assert.equal(
      isCorreoAgencyOperational(transformCorreoAgency({ status: 'ACTIVE' })),
      false,
    );
  });

  it('con deactivation_date no es operativa', () => {
    assert.equal(
      isCorreoAgencyOperational(
        transformCorreoAgency({
          agency_id: 'SCQ',
          deactivation_date: '2025-12-31',
        }),
      ),
      false,
    );
  });

  it('status inactivo (en inglés o español) no es operativa', () => {
    for (const status of ['INACTIVE', 'inactiva', 'Baja']) {
      assert.equal(
        isCorreoAgencyOperational(
          transformCorreoAgency({ agency_id: 'SCQ', status }),
        ),
        false,
        `${status} no debería ser operativa`,
      );
    }
  });

  it('sin status se asume operativa (el campo es opcional)', () => {
    assert.equal(
      isCorreoAgencyOperational(transformCorreoAgency({ agency_id: 'SCQ' })),
      true,
    );
  });
});

/**
 * ⚠️ Fixtures **SINTÉTICAS**, derivadas del ejemplo de respuesta del manual y
 * estiradas a mano para cubrir casos borde. NO salieron de `GET /agencies`: no
 * hay credenciales todavía y ningún test sale a la red.
 *
 * Los casos borde que cubren (cada uno es una SUPOSICIÓN de qué puede traer la
 * API, no algo observado):
 *  - `status` y `deactivation_date` en `null` → sucursal operativa.
 *  - `open_hours`, `maximum_package_dimensions` y `volumetric_capacity` enteros
 *    en `null`, como en el ejemplo del manual.
 *  - `agency_id` de 3 chars.
 *  - una sucursal sin `zip_code` y otra sin geolocalización.
 *  - provincias que resuelven a códigos de una letra distintos.
 *
 * PENDIENTE DE VERIFICAR EN QA: cuánto de esto se parece al padrón real. Si la
 * API devuelve formas que estas fixtures no cubren, se agregan acá.
 */
describe('transformCorreoAgency — fixtures sintéticas con casos borde', () => {
  const raw = sampleAgencies as unknown as CorreoRawAgency[];
  const agencies = transformCorreoAgencies(raw);

  it('transforma las cinco sin perder ninguna', () => {
    assert.equal(agencies.length, 5);
  });

  it('todas resuelven province_code de una letra (el que manda el módulo)', () => {
    assert.deepEqual(
      agencies.map((agency) => agency.address.province_code),
      ['C', 'B', 'Y', 'L', 'V'],
    );
  });

  it('el CPA se reduce al CP de 4 dígitos', () => {
    // "C1427EDT" → "1427". El carrito compara contra 4 dígitos.
    assert.equal(agencies[0].address.postal_code, '1427');
    assert.equal(agencies[2].address.postal_code, '4607');
  });

  it('una sucursal sin zip_code queda con postal_code vacío, no rota', () => {
    assert.equal(agencies[1].address.postal_code, '');
    assert.equal(isCorreoAgencyOperational(agencies[1]), true);
  });

  it('sin geolocalización devuelve coordinates null, no NaN', () => {
    assert.equal(agencies[2].coordinates, null);
    assert.notEqual(agencies[0].coordinates, null);
  });

  // ⚠️ El caso que motivó el diseño: si `parseOpenHours` emitiera los 8 días con
  // is_closed true, el checkout mostraría "cerrado toda la semana" para cada
  // sucursal que venga así. Vacío = "Correo no informa" → usar `schedule`.
  it('open_hours todo en null → operating_hours vacío, y schedule tiene la data', () => {
    for (const agency of agencies) {
      assert.deepEqual(agency.operating_hours, []);
    }
    assert.match(agencies[0].schedule ?? '', /LUN A VIE \d{2}\.\d{2} A \d{2}\.\d{2}/);
  });

  it('pickup_availability se lee como boolean real, sin coercionar', () => {
    assert.equal(agencies[3].pickup_availability, false);
    assert.equal(agencies[0].pickup_availability, true);
  });

  it('todas son operativas: con status y deactivation_date en null', () => {
    assert.equal(agencies.every(isCorreoAgencyOperational), true);
  });
});
