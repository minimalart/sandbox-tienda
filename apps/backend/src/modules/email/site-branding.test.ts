import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * El branding del mail (logo, colores, remitente) se resuelve por tienda.
 *
 * Lo que este archivo protege es el CACHE. El provider cachea el branding un minuto
 * para no consultar la DB en cada envío, y con un solo slot el primer mail de la
 * tienda A dejaría su logo cacheado — y todos los mails de la tienda B en esa
 * ventana saldrían con la marca de A.
 *
 * Es el modo de falla más caro del módulo porque el mail YA SALIÓ: no hay forma de
 * deshacerlo, y el que lo nota es el cliente final.
 *
 * Se verifica sobre el fuente porque instanciar el provider necesita un container.
 */

const SERVICE = readFileSync(join(import.meta.dirname, 'service.ts'), 'utf8');

test('el cache de branding está indexado POR TIENDA', () => {
  assert.match(
    SERVICE,
    /private brandingCache = new Map</,
    'el cache volvió a ser un slot único: los mails de una tienda saldrían con la marca de otra',
  );
  assert.match(SERVICE, /this\.brandingCache\.get\(cacheKey\)/);
  // Y toda escritura pasa por la clave. Un `.set('x'` fijo sería el mismo bug.
  const writes = SERVICE.match(/this\.brandingCache\.set\([^)]*/g) ?? [];
  assert.ok(writes.length >= 3, 'faltan rutas de escritura del cache');
  for (const write of writes) {
    assert.match(write, /set\(cacheKey/, `escritura sin clave de tienda: ${write}`);
  }
});

test('la precedencia es la tienda primero, el global después', () => {
  // Si la fila global fuera primero, ninguna tienda podría tener branding propio:
  // la global existe siempre y cortaría la búsqueda antes de llegar a la de la tienda.
  const body = SERVICE.slice(SERVICE.indexOf('private async readBrandingRow'));
  const siteRow = body.indexOf('"site_id" = ?');
  const globalRow = body.indexOf('"site_id" IS NULL');
  assert.ok(siteRow > -1, 'no lee la fila de la tienda');
  assert.ok(globalRow > siteRow, 'la fila de la tienda tiene que ir primero');
});

test('lee de la MISMA tabla que escribe el admin', () => {
  // El lazo que importa: la pantalla de Preferencias escribe `store_setting` con el
  // site de la request. Si el provider leyera de otra tabla, el operador guardaría
  // el branding de su tienda y los mails seguirían saliendo con el global — sin
  // ningún error, sólo un logo que no cambia nunca.
  const body = SERVICE.slice(SERVICE.indexOf('private async readBrandingRow'));
  assert.match(body, /FROM "store_setting"/);
  assert.doesNotMatch(body, /FROM "site_setting"/);
});

test('la tienda se deriva por el resolvedor del seam, no con SQL propio', () => {
  // El nombre de la tabla vive en `module-key.ts` y es el único literal del repo.
  // Repetirlo acá haría que renombrar el módulo rompa los mails en silencio.
  const body = SERVICE.slice(SERVICE.indexOf('private async siteIdForNotification'));
  assert.match(body, /resolveSiteViaSql/);
  assert.doesNotMatch(body, /FROM "demo_store"/);
});

test('sin tienda en la data, el mail cae a la tienda IMPLÍCITA', () => {
  // Cambió, y el cambio es el arreglo. Antes esto devolvía `null` a secas, y con `null`
  // la plantilla de la tienda era INALCANZABLE: `loadDbTemplate` sólo podía matchear la
  // global. En una instalación de una sola tienda eso significaba que el operador
  // editaba la plantilla, la publicaba, y el mail seguía saliendo con el texto del
  // código — sin un solo error.
  //
  // `implicitSiteId` resuelve la única tienda que hay, y devuelve `null` cuando hay
  // varias. La cota de seguridad —que NUNCA cae a la principal— la protege
  // `db-template-pick.test.ts`, que es donde vive el resto de esta regla.
  const body = SERVICE.slice(
    SERVICE.indexOf('private async siteIdForNotification'),
    SERVICE.indexOf('private async implicitSiteId'),
  );
  assert.match(
    body,
    /return this\.implicitSiteId\(\);/,
    'volvió el `return null` que dejaba la plantilla de la tienda inalcanzable',
  );
});

// ── Los emisores que ya declaran su tienda ───────────────────────────────────────

const SRC = join(import.meta.dirname, '..', '..');

const WIRED = [
  { file: join(SRC, 'subscribers', 'order-placed-email.ts'), label: 'orden confirmada (email)' },
  { file: join(SRC, 'lib', 'whatsapp', 'send-order-notification.ts'), label: 'orden (WhatsApp)' },
  // El formulario de contacto se mudó a @minimalart/mercatto-plugin-contact y
  // esta entrada quedó apuntando a un archivo que YA NO EXISTE. No dio verde
  // silencioso —el `readFileSync` tira ENOENT y el test estaba rojo en el
  // baseline—, que es lo mínimo, pero un test rojo que nadie mira guarda lo mismo
  // que uno borrado: durante todo ese tiempo nada verificaba que el contacto
  // declarara su tienda. Y NO la declaraba: `contact-received` y
  // `contact-notification-admin` salían sin `site_id`, y el destinatario del
  // aviso interno se leía de la fila GLOBAL de `email_branding`.
  //
  // Apunta al plugin: es donde vive el emisor. Si el plugin no está instalado en
  // este checkout, el archivo no está y el test vuelve a fallar — que es el
  // comportamiento correcto para un monorepo que SÍ lo tiene versionado.
  {
    file: join(
      SRC, '..', '..', '..', 'packages', 'plugins', 'plugin-contact',
      'src', 'api', 'store', 'contact-submissions', 'route.ts',
    ),
    label: 'formulario de contacto',
    // Sólo existe como FUENTE en el monorepo. En un proyecto de cliente el plugin
    // llega por npm y este archivo no está: el test se saltea en vez de fallar,
    // que es lo que hace útil el rojo del monorepo.
    soloEnElMonorepo: true,
  },
  { file: join(SRC, 'subscribers', 'return-requested-notify.ts'), label: 'devolución solicitada' },
  { file: join(SRC, 'subscribers', 'recurring-order-placed.ts'), label: 'renovación generada' },
  { file: join(SRC, 'subscribers', 'company-created-email.ts'), label: 'alta de empresa' },
  { file: join(SRC, 'subscribers', 'corporate-created-email.ts'), label: 'alta de corporate' },
  { file: join(SRC, 'subscribers', 'corporate-activated-email.ts'), label: 'corporate activado' },
  // notify-abandoned-cart: moved to @minimalart/mercatto-plugin-abandoned-cart
  { file: join(SRC, 'workflows', 'process-renewal-cycle.ts'), label: 'ciclo de renovación' },
  { file: join(SRC, 'workflows', 'invite-company-member.ts'), label: 'invitación a empresa' },
  { file: join(SRC, 'workflows', 'invite-corporate-member.ts'), label: 'invitación a corporate' },
  { file: join(SRC, 'jobs', 'process-recurring-renewals.ts'), label: 'recordatorio de renovación' },
  { file: join(SRC, 'subscribers', 'order-placed-whatsapp.ts'), label: 'orden confirmada (WhatsApp)' },
  { file: join(SRC, 'subscribers', 'order-cancelled-whatsapp.ts'), label: 'orden cancelada (WhatsApp)' },
  // gift-card-experience/{delivery,lifecycle}.ts: moved to
  // @minimalart/mercatto-plugin-gift-cards; the site-branding declarations were
  // preserved inside the plugin's src/modules/gift-card-experience/ and are
  // enforced by the plugin's own test suite.
  { file: join(SRC, 'api', 'store', 'recurring-orders', '[id]', 'cancel', 'route.ts'), label: 'baja de suscripción' },
  { file: join(SRC, 'api', 'store', 'recurring-orders', '[id]', 'pause', 'route.ts'), label: 'pausa de suscripción' },
  { file: join(SRC, 'api', 'admin', 'email-templates', '[id]', 'test-send', 'route.ts'), label: 'envío de prueba' },
  // Los dos oyentes de `auth.password_reset`. Estaban en CANNOT_DECLARE con el reason
  // "el evento trae { entity_id, token, actor_type }: ni canal ni request". Era falso:
  // el payload de `generateResetPasswordTokenWorkflow` tiene un cuarto campo,
  // `metadata`, que la ruta del core copia del body y el storefront ya poblaba con
  // `{ sales_channel_id, country_code, web_url }`. Los subscribers lo tiraban.
  { file: join(SRC, 'subscribers', 'password-reset-email.ts'), label: 'reseteo de contraseña' },
  { file: join(SRC, 'subscribers', 'password-reset-whatsapp.ts'), label: 'reseteo de contraseña (WhatsApp)' },
];

/**
 * Los que NO pueden declarar tienda, y por qué.
 *
 * ERAN TRES Y AHORA SON DOS. `password-reset-email` estaba acá con un motivo que no
 * resistió la lectura del workflow del core: el evento SÍ trae un cuarto campo. Antes
 * de agregar una entrada nueva a esta lista, abrir el emisor del evento en
 * `node_modules/@medusajs/core-flows` — no alcanza con la documentación.
 *
 * No es deuda: el evento que los dispara no lleva ningún eje, así que cablearlos
 * exigiría cambiar el payload del evento —de Medusa, no nuestro— o inventar un
 * default. Se listan acá para que nadie los "complete" sin ver el costo.
 */
const CANNOT_DECLARE = [
  {
    file: join(SRC, 'subscribers', 'customer-created-email.ts'),
    why: 'el evento trae { id } del customer, y un customer de Medusa no tiene canal',
  },
  {
    file: join(SRC, 'subscribers', 'invite-email.ts'),
    why: 'invita a un usuario ADMIN, que opera sobre toda la instancia: la tienda no aplica',
  },
];

for (const emitter of CANNOT_DECLARE) {
  test(`sigue sin poder declarar tienda: ${emitter.why}`, () => {
    // Si alguien le agrega el campo, este test falla y obliga a mover la entrada a
    // WIRED — es decir, a demostrar que de verdad viaja y no quedó en `undefined`.
    const src = readFileSync(emitter.file, 'utf8');
    assert.doesNotMatch(
      src,
      /sales_channel_id|site_id/,
      `Si ya puede declarar su tienda, movelo a WIRED y sacalo de acá.`,
    );
  });
}

for (const emitter of WIRED) {
  // `soloEnElMonorepo`: el emisor vive en un plugin publicado y acá lo tenemos
  // como fuente sólo porque es el mismo repo. En un proyecto de cliente llega
  // compilado por npm: saltear es lo correcto — fallar sería un rojo permanente
  // que enseña a ignorar este archivo.
  const ausente = 'soloEnElMonorepo' in emitter && !existsSync(emitter.file);
  test(`${emitter.label}: declara la tienda de origen`, { skip: ausente }, () => {
    const src = readFileSync(emitter.file, 'utf8');
    // Tiene que pedirle el campo al graph Y ponerlo en la data. Pedirlo y no
    // mandarlo es el error silencioso: compila, corre, y no scopea nada.
    assert.match(src, /sales_channel_id|site_id/);
    const emitsIt =
      /sales_channel_id: [^,\n]+/.test(src) || /site_id,/.test(src) || /site_id:/.test(src);
    assert.ok(emitsIt, 'lee el canal pero no lo manda en la data de la notificación');
  });
}

/**
 * `sales_channel_name` encabeza el subject de media docena de plantillas
 * (`[{{sales_channel_name}}] Restablecer tu contraseña`) y NO LO LLENABA NADIE.
 * Handlebars resuelve la variable ausente a cadena vacía sin error, así que el mail
 * salía con `[] Restablecer tu contraseña` y nada en el log. En desdeelsur eran 0 de
 * 59 notificaciones de mail las que la traían.
 */
test('`sales_channel_name` se inyecta con el nombre de la tienda', () => {
  const body = SERVICE.slice(SERVICE.indexOf('async send('));
  assert.match(
    body,
    /fillEmpty\('sales_channel_name', branding\.cde_display_name\)/,
    'sin esto los subjects que la usan salen con corchetes vacíos',
  );
});

test('la inyección va por `fillEmpty`, no por asignación directa', () => {
  // El emisor que SÍ conoce el canal real (los de órdenes lo mandan) tiene que ganar.
  const body = SERVICE.slice(SERVICE.indexOf('async send('));
  assert.doesNotMatch(body, /data\.sales_channel_name\s*=/);
});

test('la inyección corre DESPUÉS de resolver el branding de la tienda', () => {
  // Al revés inyectaría el branding de la tienda anterior (o los defaults).
  const body = SERVICE.slice(SERVICE.indexOf('async send('));
  const branding = body.indexOf('const branding = await this.loadBranding');
  const fill = body.indexOf("fillEmpty('sales_channel_name'");
  assert.ok(branding > -1 && fill > branding, 'se inyecta antes de saber de qué tienda es');
});

// ── El destinatario de los avisos internos ──────────────────────────────────────

/**
 * Los avisos al admin de UNA MISMA TIENDA tienen que ir a UNA sola casilla.
 *
 * EL BUG QUE ESTA SECCIÓN CIERRA, medido en desdeelsur el 2026-09-03. Es una
 * instalación MONO-TIENDA (una sola fila viva en el registro) con las dos filas
 * de `email_branding` cargadas: la de `demo_main` con `info@desdelsur.com.ar` y
 * la GLOBAL con otra casilla. Las notificaciones enviadas mostraban:
 *
 *   order-notification-admin    → info@desdelsur.com.ar   (fila de la tienda)
 *   contact-notification-admin  → la casilla de la global
 *
 * La primera llega con `salesChannelId` y resuelve `status === 'site'`. Los
 * emisores SIN pista —el handoff de WhatsApp acá, y el formulario de contacto en
 * su propio plugin— caían a `null`, y `readSetting(key, null)` saltea la fila de
 * la tienda: gana la global. Dos avisos de la misma tienda, dos buzones, y el
 * operador mira uno solo.
 */
/**
 * Los comentarios NO cuentan.
 *
 * Media docena de las aserciones de abajo son "esta forma no puede volver", y los
 * comentarios de `admin-recipient.ts` CITAN las formas viejas (`if (!hint) return
 * null`, `allowMainFallback`) para explicar por qué se fueron. Sin este filtro, el
 * propio comentario que documenta el bug hace fallar el test que lo previene — y el
 * arreglo obvio, borrar el comentario, es exactamente el peor. Mismo criterio y
 * mismo motivo que `db-template-pick.test.ts`.
 */
const sinComentarios = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[^\n'"`]*\/\/.*$/gm, '');

const ADMIN_RECIPIENT = sinComentarios(
  readFileSync(join(import.meta.dirname, 'admin-recipient.ts'), 'utf8'),
);

test('sin pista, el destinatario cae a la tienda IMPLÍCITA y no a la fila global', () => {
  // El `if (!hint) return null` era el bug: cortaba antes de preguntarle al
  // registro cuántas tiendas hay.
  assert.doesNotMatch(
    ADMIN_RECIPIENT,
    /if \(!hint\) return null;/,
    'volvió el early return: los emisores sin pista vuelven a la casilla global',
  );
  assert.match(
    ADMIN_RECIPIENT,
    /resolveSite\(container, hint \?\? \{\}\)/,
    'sin pista hay que preguntar con hint vacío, que es como el seam responde `singleSite`',
  );
  assert.match(
    ADMIN_RECIPIENT,
    /status === 'site' \|\| resolution\.status === 'singleSite'/,
    'con UNA sola tienda, `singleSite` ES la tienda del aviso',
  );
});

test('el destinatario NUNCA cae a la tienda principal', () => {
  // La cota que no se puede cruzar, igual que en el provider: con varias tiendas,
  // elegir la `is_main` manda el aviso de la tienda B al buzón del operador de la
  // A. Y el mail ya salió.
  assert.doesNotMatch(
    ADMIN_RECIPIENT,
    /allowMainFallback/,
    'caer a la principal es adivinar: mandaría el aviso de una tienda a la casilla de otra',
  );
});

test('la tienda se deriva por el resolvedor del seam, no con SQL propio', () => {
  assert.match(ADMIN_RECIPIENT, /from '\.\.\/\.\.\/lib\/multistore\/resolve-site'/);
  assert.doesNotMatch(ADMIN_RECIPIENT, /demo_store/);
});

/**
 * El formulario de contacto NO pasa por `admin-recipient.ts`: vive en
 * `plugin-contact` y tiene su propio shim, que llamaba `getEmailBranding()` SIN
 * ARGUMENTOS. Es el camino que produjo el síntoma medido, y arreglar sólo el
 * host lo habría dejado intacto — por eso se verifica acá, al lado del otro.
 */
const CONTACT_SHIM_PATH = join(
  import.meta.dirname, '..', '..', '..', '..', '..',
  'packages', 'plugins', 'plugin-contact', 'src', 'lib', 'admin-email-shim.ts',
);
// Igual que la entrada del formulario en WIRED: fuente sólo en el monorepo.
const CONTACT_SHIM = existsSync(CONTACT_SHIM_PATH)
  ? sinComentarios(readFileSync(CONTACT_SHIM_PATH, 'utf8'))
  : '';

test('el shim de contacto le pasa la tienda a getEmailBranding', {
  skip: !existsSync(CONTACT_SHIM_PATH),
}, () => {
  assert.match(
    CONTACT_SHIM,
    /getEmailBranding\(siteId\)/,
    'sin el argumento, `readSetting` saltea la fila de la tienda y devuelve la global',
  );
  assert.doesNotMatch(
    CONTACT_SHIM,
    /getEmailBranding\(\)/,
    'volvió la llamada sin tienda: el aviso de contacto vuelve a la casilla global',
  );
});
