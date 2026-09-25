/**
 * Bridge del `@minimalart/mercatto-plugin-runtime`.
 *
 * Cablea UNA sola vez los lectores que el contract expone: cualquier plugin
 * publicado que consuma `@minimalart/mercatto-plugin-runtime` los ve.
 *
 * ─── QUÉ CABLEA ─────────────────────────────────────────────────────────────
 *
 * 1. `registerAppSettingsSyncReader((namespace, key) => value)` — resuelve el
 *    valor efectivo de una key del snapshot de `app-settings` a partir del
 *    descriptor. Cualquier plugin con settings admin-editables lo consulta con
 *    `getAppSettingsSyncReader()`; cae a env si no hay reader registrado.
 *
 * 2. `registerExternalReader(EXTERNAL_KEYS.KAPSO_WHATSAPP_SETTINGS, () => ...)` —
 *    expone la shape de `kapso-whatsapp/settings` a los plugins que la
 *    consuman. Hoy solo la usa `plugin-abandoned-cart` para sus templates.
 *
 * ─── POR QUÉ NO ES POR-PLUGIN ───────────────────────────────────────────────
 *
 * Este archivo no importa ningún plugin, y `medusa-config.ts` lo importa como
 * side effect UNA VEZ. Sumar un plugin nuevo con settings admin no requiere
 * cambiar nada acá: el descriptor entra al índice de `app-settings/descriptors/`,
 * el plugin usa `getAppSettingsSyncReader()`, y este bridge le sirve el snapshot
 * transparentemente.
 *
 * Para exponer un módulo NUEVO del host a los plugins (por ejemplo,
 * `store-config/site`), sumar la key en `EXTERNAL_KEYS` del contract y una
 * llamada más a `registerExternalReader` acá.
 *
 * ─── POR QUÉ CORRE AL IMPORT ────────────────────────────────────────────────
 *
 * `medusa-config.ts` lo importa con un side effect. Al cargar el módulo, Node
 * ejecuta el registro una sola vez, antes de que el runtime de Medusa levante
 * los jobs y las rutas. Cuando el primer plugin consulta el reader, ya está.
 */
import {
  EXTERNAL_KEYS,
  registerAppSettingsSyncReader,
  registerExternalReader,
} from '@minimalart/mercatto-plugin-runtime';
import { findDescriptor, findNamespace } from '../modules/app-settings/descriptors';
import { resolveSettingSync } from '../modules/app-settings/resolve';
import { getKapsoSettings } from '../modules/kapso-whatsapp/settings';
import { readSettingsViaPg } from '../modules/app-settings/read-via-pg';
import { canSendConsentEvent } from '../lib/consent-server-events';
import { loadLazyModule, sourceSpecifier } from '../lib/lazy-module';

/** Sólo tipos: `typeof import()` no emite, así que no entra al grafo de arranque. */
type AppSettingsService = typeof import('../modules/app-settings/service.js');
type AbandonedCartSettings = typeof import('../modules/app-settings/abandoned-cart-settings.js');
type MultistorePublicUrl = typeof import('../lib/multistore/public-url.js');

// ─── App-settings ────────────────────────────────────────────────────────────

registerAppSettingsSyncReader((namespace, key) => {
  const descriptor = findDescriptor(namespace, key);
  if (!descriptor) return undefined;
  const value = resolveSettingSync(descriptor);
  return value === null ? undefined : value;
});

// ─── kapso-whatsapp ──────────────────────────────────────────────────────────
//
// kapso es first-party en mercatto/desdeelsur, no hay try/catch dinámico. Un
// proyecto sin kapso-whatsapp saca este archivo del composer o comenta esta
// llamada.

registerExternalReader(EXTERNAL_KEYS.KAPSO_WHATSAPP_SETTINGS, () => getKapsoSettings());
// Stable reader key also supported by the currently published runtime 0.4.0.
registerExternalReader('app-settings/via-pg', () => readSettingsViaPg);
registerExternalReader('consent/event-permission', () => canSendConsentEvent);

// Jobs and workflows resolve the same site-scoped values as the settings API.
registerExternalReader('app-settings/scoped', () => async (container: import('@medusajs/framework/types').MedusaContainer, namespace: string, resolution: import('../lib/multistore/types').SiteResolution) => {
  // `findNamespace` sale del import ESTÁTICO de arriba: `descriptors/` ya está en
  // el grafo por `findDescriptor`, así que cargarlo otra vez en diferido no
  // compraba nada y rompía el reader entero (`Cannot find module
  // '…/modules/app-settings/descriptors/index.js'`, 2026-09-18 12:22:27, para las
  // 7 tiendas y CADA MINUTO). El resto sigue diferido a propósito: este archivo lo
  // importa `medusa-config.ts` como side effect y `service.ts` arrastra el
  // contenedor de Medusa al momento de leer la config.
  const settingsService = await loadLazyModule<AppSettingsService>(
    'el servicio de app-settings',
    () => require('../modules/app-settings/service'),
    () => import(sourceSpecifier('../modules/app-settings/service')),
  );
  const descriptors = findNamespace(namespace)?.settings;
  if (!descriptors) throw new Error(`Unknown settings namespace: ${namespace}`);
  if (namespace === 'extension:abandoned-cart') {
    const { withLegacyCartTemplates } = await loadLazyModule<AbandonedCartSettings>(
      'los settings de carrito abandonado',
      () => require('../modules/app-settings/abandoned-cart-settings'),
      () => import(sourceSpecifier('../modules/app-settings/abandoned-cart-settings')),
    );
    const states = await withLegacyCartTemplates(container, await settingsService.getStates(container, descriptors, resolution), resolution);
    return Object.fromEntries(states.map(state => [state.key, state.value]));
  }
  return settingsService.resolveMany(container, descriptors, resolution);
});
registerExternalReader('multistore/storefront-url', () => async (site: { id: string; slug: string; is_main: boolean }) => {
  const { siteStorefrontUrl } = await loadLazyModule<MultistorePublicUrl>(
    'la URL pública del storefront',
    () => require('../lib/multistore/public-url'),
    () => import(sourceSpecifier('../lib/multistore/public-url')),
  );
  return siteStorefrontUrl(site);
});
