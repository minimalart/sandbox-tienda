import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import KapsoWhatsappProviderService from './service';
import { KapsoClient } from './client';
import { WHATSAPP_SETTINGS_NAMESPACE } from './settings';
import { invalidateNamespace } from '../../lib/settings-cache';
import { encryptCredentials } from '../../lib/multistore/credentials';

/**
 * De dónde saca el provider las credenciales para ENVIAR.
 *
 * El caso testigo es el que rompió desdeelsur: la API key y el `phone_number_id`
 * cargados desde el admin (o sea en `site_setting`) y el entorno vacío. El
 * provider caía en modo LOG y devolvía un id `log-…`, así que Medusa daba el
 * envío por exitoso y el WhatsApp no salía nunca — sin un solo error. Lo que
 * hacía el bug INVISIBLE es que `/admin/kapso/templates` sí lee esa misma key:
 * el admin mostraba la integración funcionando mientras el envío estaba muerto.
 */

/** El sobre que `readEntriesFromBlob` espera dentro de `site_setting.value`. */
function settingsBlob(entries: Record<string, string>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(entries).map(([key, value]) => [
      key,
      // `is_secret: false` a propósito: con `true` el resolver iría a descifrar y
      // el test estaría midiendo la KEK en vez de la precedencia.
      { key, value, ciphertext: null, is_secret: false, updated_at: null, updated_by: null },
    ]),
  );
}

/**
 * `PG_CONNECTION` mínima. El provider la usa para DOS lecturas distintas y hay
 * que distinguirlas por la tabla: `site_setting` son los ajustes, `store_setting`
 * son los bindings de plantilla (acá siempre vacíos, para que resuelva por el
 * fallback hardcodeado).
 */
function fakePg(
  entries: Record<string, string>,
  siteCredentials?: Record<string, string>,
) {
  return {
    raw: async (sql: string) => {
      if (sql.includes('site_setting')) {
        return { rows: [{ value: settingsBlob(entries) }] };
      }
      // La credencial POR TIENDA va cifrada de verdad: con un blob a mano el test
      // mediría el stub y no el camino que corre en producción.
      if (sql.includes('site_credential')) {
        return siteCredentials
          ? { rows: [{ credentials_enc: encryptCredentials(siteCredentials) }] }
          : { rows: [] };
      }
      if (sql.includes('demo_store')) {
        return { rows: [{ id: 'demo_main', slug: 'principal', name: 'Principal', is_main: true }] };
      }
      return { rows: [] };
    },
  };
}

type SentMessage = {
  phoneNumberId: string;
  payload: Record<string, unknown>;
  /** La API key con la que SALIÓ el mensaje, leída del header del cliente. */
  apiKey: string;
};

function buildService(opts: {
  entries?: Record<string, string>;
  options?: Record<string, unknown>;
  siteCredentials?: Record<string, string>;
}) {
  const warnings: string[] = [];
  const logger = {
    info: () => {},
    warn: (msg: string) => warnings.push(msg),
    error: () => {},
  };
  const cradle = {
    logger,
    [ContainerRegistrationKeys.PG_CONNECTION]: fakePg(opts.entries ?? {}, opts.siteCredentials),
  };
  const service = new (KapsoWhatsappProviderService as unknown as new (
    cradle: unknown,
    options: unknown,
  ) => {
    send: (n: Record<string, unknown>) => Promise<{ id?: string }>;
  })(cradle, opts.options ?? {});

  return { service, warnings };
}

const notification = {
  to: '+54 9 3329 67-6338',
  channel: 'whatsapp',
  template: 'order-confirmation',
  data: { customer_name: 'Camila', display_id: 71, total: '187.977,46' },
};

let sent: SentMessage[] = [];

beforeEach(() => {
  sent = [];
  // Los ajustes se memoizan por namespace: sin esto, el segundo test lee la
  // configuración del primero y pasa por el motivo equivocado.
  invalidateNamespace(WHATSAPP_SETTINGS_NAMESPACE);
  mock.method(
    KapsoClient.prototype,
    'sendMessage',
    // `function` y no flecha a propósito: hace falta el `this` para leer con qué
    // API key salió. Es el ÚNICO discriminador cuando el número es el mismo en
    // los dos caminos, que es justo el caso que produjo el 401.
    async function (
      this: { http?: { defaults?: { headers?: Record<string, unknown> } } },
      phoneNumberId: string,
      payload: Record<string, unknown>,
    ) {
      sent.push({
        phoneNumberId,
        payload,
        apiKey: String(this?.http?.defaults?.headers?.['X-API-Key'] ?? ''),
      });
      return { id: 'wamid.TEST', raw: {} };
    },
  );
});

afterEach(() => {
  mock.restoreAll();
  invalidateNamespace(WHATSAPP_SETTINGS_NAMESPACE);
});

describe('KapsoWhatsappProviderService.send — origen de las credenciales', () => {
  test('envía con lo configurado en el admin aunque el entorno esté vacío', async () => {
    const { service } = buildService({
      entries: { KAPSO_API_KEY: 'kapso-key', KAPSO_PHONE_NUMBER_ID: '499733153232884' },
      options: {},
    });

    const result = await service.send(notification);

    assert.equal(sent.length, 1, 'el mensaje tiene que salir, no quedar en el log');
    assert.equal(sent[0].phoneNumberId, '499733153232884');
    assert.equal(result.id, 'wamid.TEST');
    assert.ok(
      !String(result.id).startsWith('log-'),
      'un id `log-…` es el modo degradado: Medusa lo da por enviado y el cliente no recibe nada',
    );
  });

  test('sigue enviando con las credenciales por env (instalaciones que no migraron)', async () => {
    const { service } = buildService({
      entries: {},
      options: { api_key: 'env-key', phone_number_id: '111222333' },
    });

    await service.send(notification);

    assert.equal(sent.length, 1);
    assert.equal(sent[0].phoneNumberId, '111222333');
  });

  test('lo configurado en el admin le gana al entorno', async () => {
    const { service } = buildService({
      entries: { KAPSO_API_KEY: 'db-key', KAPSO_PHONE_NUMBER_ID: '999' },
      options: { api_key: 'env-key', phone_number_id: '111' },
    });

    await service.send(notification);

    assert.equal(sent[0].phoneNumberId, '999');
  });

  test('sin credenciales en ningún lado degrada a log y DICE qué falta', async () => {
    const { service, warnings } = buildService({ entries: {}, options: {} });

    const result = await service.send(notification);

    assert.equal(sent.length, 0);
    assert.ok(String(result.id).startsWith('log-'));
    const warning = warnings.join('\n');
    assert.match(warning, /API key/);
    assert.match(warning, /phone_number_id/);
    assert.match(warning, /NO se envía/);
  });

  test('con la API key pero sin número, el warning nombra sólo el número', async () => {
    const { service, warnings } = buildService({
      entries: { KAPSO_API_KEY: 'kapso-key' },
      options: {},
    });

    await service.send(notification);

    assert.equal(sent.length, 0);
    const warning = warnings.join('\n');
    assert.match(warning, /phone_number_id/);
    assert.ok(!/API key/.test(warning), 'la API key está: nombrarla manda a buscar donde no es');
  });

  test('el template sale del fallback con el nombre y el idioma de la config', async () => {
    const { service } = buildService({
      entries: {
        KAPSO_API_KEY: 'kapso-key',
        KAPSO_PHONE_NUMBER_ID: '499733153232884',
        KAPSO_TEMPLATE_ORDER_CONFIRMATION: 'order_confirmation_v2',
        KAPSO_TEMPLATE_LANG: 'es_AR',
      },
      options: {},
    });

    await service.send(notification);

    const template = sent[0].payload.template as {
      name: string;
      language: { code: string };
      components: Array<{ parameters: Array<{ text: string }> }>;
    };
    assert.equal(template.name, 'order_confirmation_v2');
    assert.equal(template.language.code, 'es_AR');
    // El orden de los parámetros lo fija la plantilla aprobada por Meta.
    assert.deepEqual(
      template.components[0].parameters.map((p) => p.text),
      ['Camila', '71', '187.977,46'],
    );
  });

  /**
   * El incidente del 22/09 en desdeelsur. La tienda tenía API key propia cargada
   * en Credenciales por tienda y el número seguía saliendo de los ajustes de la
   * instancia: Kapso devolvía 401 `Invalid credentials for WhatsApp configuration`
   * —la key es válida, pero no sobre ESE número— y la orden se confirmaba sin que
   * saliera la confirmación. El bot seguía contestando porque usa el par global,
   * así que desde afuera la integración parecía sana.
   */
  test('con key propia pero sin número propio usa el par de la instancia, no una mezcla', async () => {
    const { service, warnings } = buildService({
      entries: { KAPSO_API_KEY: 'key-instancia', KAPSO_PHONE_NUMBER_ID: 'phone-instancia' },
      siteCredentials: { apiKey: 'key-de-la-tienda' },
    });

    await service.send({ ...notification, data: { ...notification.data, site_id: 'demo_main' } });

    assert.equal(sent.length, 1);
    // LA aserción del incidente. El número es el de la instancia en los dos
    // caminos, así que sola no prueba nada: lo que separa el arreglo del bug es
    // que la key también sea la de la instancia y no la de la tienda.
    assert.equal(
      sent[0].apiKey,
      'key-instancia',
      'key de la tienda + número de la instancia es el 401 que rompió producción',
    );
    assert.equal(sent[0].phoneNumberId, 'phone-instancia');
    assert.ok(
      warnings.some((w) => w.includes("no 'phoneNumberId'")),
      'el operador tiene que enterarse de que la credencial está a medias',
    );
  });

  test('con el par completo de la tienda manda desde el número de la tienda', async () => {
    const { service } = buildService({
      entries: { KAPSO_API_KEY: 'key-instancia', KAPSO_PHONE_NUMBER_ID: 'phone-instancia' },
      siteCredentials: { apiKey: 'key-de-la-tienda', phoneNumberId: 'phone-de-la-tienda' },
    });

    await service.send({ ...notification, data: { ...notification.data, site_id: 'demo_main' } });

    assert.equal(sent.length, 1);
    assert.equal(sent[0].apiKey, 'key-de-la-tienda');
    assert.equal(sent[0].phoneNumberId, 'phone-de-la-tienda');
  });

  test('normaliza el teléfono al formato de Meta (sólo dígitos)', async () => {
    const { service } = buildService({
      entries: { KAPSO_API_KEY: 'kapso-key', KAPSO_PHONE_NUMBER_ID: '499733153232884' },
      options: {},
    });

    await service.send(notification);

    assert.equal(sent[0].payload.to, '5493329676338');
  });
});
