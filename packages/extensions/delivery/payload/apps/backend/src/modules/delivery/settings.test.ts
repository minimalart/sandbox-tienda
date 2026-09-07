import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import descriptors from '../app-settings/descriptors/delivery.ts';
import {
  DELIVERY_SETTINGS_NAMESPACE,
  getDeliverySettings,
  getGoogleMapsApiKey,
  isOwnFleetAutoFulfillEnabled,
} from './settings.ts';

/**
 * Sin base en los tests, así que se ejercita el tramo **env > default** del
 * resolver: el comportamiento que la migración tenía que preservar. Lo que de
 * verdad importa acá es el ALIAS — `GOOGLE_MAPS_API_KEY` y
 * `VITE_GOOGLE_MAPS_API_KEY` son la misma credencial y hay que saber cuál gana.
 */

const ENV_KEYS = [
  'GOOGLE_MAPS_API_KEY',
  'VITE_GOOGLE_MAPS_API_KEY',
  'OWN_FLEET_AUTO_FULFILL',
  'APP_SETTINGS_DISABLE',
];

beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

test('el namespace es el que declara el manifest de la extensión', () => {
  assert.equal(DELIVERY_SETTINGS_NAMESPACE, 'extension:delivery');
});

/* -------------------------------------------------------------------------- */
/* Alias de la key de Google                                                   */
/* -------------------------------------------------------------------------- */

test('con las dos env presentes gana GOOGLE_MAPS_API_KEY', () => {
  // Es el orden que ya tenía `geocoding.ts:50-55` (`?? VITE_...`). Invertirlo
  // haría que un deploy con las dos cargadas empiece a facturar contra otro
  // proyecto de Google sin que nadie tocara nada.
  process.env.GOOGLE_MAPS_API_KEY = 'key-backend';
  process.env.VITE_GOOGLE_MAPS_API_KEY = 'key-admin';
  assert.equal(getGoogleMapsApiKey(), 'key-backend');
});

test('la VITE_ sigue siendo el fallback cuando no está la otra', () => {
  process.env.VITE_GOOGLE_MAPS_API_KEY = 'key-admin';
  assert.equal(getGoogleMapsApiKey(), 'key-admin');
});

test('una env definida EN BLANCO no tapa al fallback', () => {
  // `coerceFromEnv` trata "definida y vacía" como ausente, que es justo lo que
  // pasa cuando un panel de deploy tiene la fila creada sin valor. Sin esto, la
  // fila vacía ganaría y el geocoding quedaría apagado con la key cargada al lado.
  process.env.GOOGLE_MAPS_API_KEY = '   ';
  process.env.VITE_GOOGLE_MAPS_API_KEY = 'key-admin';
  assert.equal(getGoogleMapsApiKey(), 'key-admin');
});

test('sin ninguna key devuelve cadena vacía, no undefined', () => {
  // El contrato con `geocodeAddress`: sin key se saltea el geocoding sin romper.
  assert.equal(getGoogleMapsApiKey(), '');
});

test('se recortan los espacios de la key', () => {
  // Una key con un salto de línea pegado desde un panel produce REQUEST_DENIED,
  // que no se parece en nada a "sobra un espacio".
  process.env.GOOGLE_MAPS_API_KEY = ' AIza-lo-que-sea \n';
  assert.equal(getGoogleMapsApiKey(), 'AIza-lo-que-sea');
});

test('la key es un secreto sin default: nunca queda en claro en el código', () => {
  const key = descriptors.settings.find((d) => d.key === 'GOOGLE_MAPS_API_KEY');
  assert.equal(key?.type, 'secret');
  assert.equal(key?.default, undefined);
  assert.deepEqual(key?.env, ['GOOGLE_MAPS_API_KEY', 'VITE_GOOGLE_MAPS_API_KEY']);
});

test('la key es de INSTANCIA: una tienda secundaria no se queda sin geocoding', () => {
  // Con `site`, el fail-closed dejaría a toda tienda que no cargó la suya sin
  // geocoding de respaldo, y el síntoma sería "en la tienda B las direcciones no
  // resuelven zona" — sin ningún error.
  const key = descriptors.settings.find((d) => d.key === 'GOOGLE_MAPS_API_KEY');
  assert.equal(key?.scope, 'instance');
});

/* -------------------------------------------------------------------------- */
/* Auto-fulfillment de flota propia                                            */
/* -------------------------------------------------------------------------- */

test('el auto-fulfillment sigue siendo opt-in explícito', () => {
  assert.equal(isOwnFleetAutoFulfillEnabled(), false);
  process.env.OWN_FLEET_AUTO_FULFILL = 'false';
  assert.equal(isOwnFleetAutoFulfillEnabled(), false);
  process.env.OWN_FLEET_AUTO_FULFILL = 'true';
  assert.equal(isOwnFleetAutoFulfillEnabled(), true);
});

test('un valor que no es "true" ni "1" deja el flag apagado', () => {
  // Prenderlo de más le crea fulfillments automáticos a una instalación que los
  // hace a mano, y eso no se deshace.
  for (const raw of ['si', 'yes', 'TRUE!', '2', 'on']) {
    process.env.OWN_FLEET_AUTO_FULFILL = raw;
    assert.equal(isOwnFleetAutoFulfillEnabled(), false, `"${raw}" prendió el auto-fulfillment`);
  }
});

test('getDeliverySettings devuelve las dos cosas de una', () => {
  process.env.GOOGLE_MAPS_API_KEY = 'k';
  process.env.OWN_FLEET_AUTO_FULFILL = 'true';
  assert.deepEqual(getDeliverySettings(), {
    googleMapsApiKey: 'k',
    ownFleetAutoFulfill: true,
  });
});
