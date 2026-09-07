import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * El contrato entre QUIEN EMITE un mail y QUIÉN SABE RENDERIZARLO.
 *
 * ── EL MODO DE FALLA QUE ESTE ARCHIVO CIERRA ─────────────────────────────────
 *
 * `createNotifications({ channel: 'email', template: 'x' })` no valida nada. Del
 * otro lado, `modules/email/service.ts:resolveContent` busca la clave en dos
 * lugares —una fila publicada en `email_template` y el mapa de
 * `modules/email/templates/index.ts`— y si no está en ninguno devuelve `null`.
 * `send()` entonces devuelve `{}` SIN LANZAR.
 *
 * Ese `{}` es deliberado y no se toca: un mail que no sale no puede tumbar un
 * checkout. Pero tiene una consecuencia que sí importa: el módulo de
 * notificaciones lo toma como envío exitoso y la fila de `notification` queda en
 * `status = 'success'`. O sea que un mail que NUNCA EXISTIÓ es indistinguible de
 * uno entregado si se mira la base. El único rastro es una línea de log.
 *
 * ── POR QUÉ UN TEST Y NO SÓLO UN WARN ────────────────────────────────────────
 *
 * Un warn en runtime sólo aparece cuando la feature ya está prendida y alguien
 * está mirando el log del backend del cliente en ese momento. Este test corre en
 * cada PR y falla ANTES de que la clave llegue a producción. El warn sigue
 * existiendo (`service.ts:warnTemplateMissing`) porque cubre lo que un test no
 * puede ver: la instalación del cliente, donde la plantilla vive en la base.
 *
 * ── CÓMO SE LEE CUANDO FALLA ─────────────────────────────────────────────────
 *
 * Es un RATCHET: la lista de abajo es el piso medido el 2026-09-03, no un ideal.
 * Si agregás un emisor nuevo, este test se pone rojo y tenés dos salidas
 * honestas: agregar la plantilla de código, o agregar la clave a
 * `SIN_PLANTILLA_DE_CODIGO` con el motivo. Lo que NO se puede es que la clave
 * aparezca sin que nadie haya decidido nada — que es exactamente cómo llegaron
 * las 19 que ya están.
 */

const BACKEND_SRC = join(import.meta.dirname, '..');

/** Sube hasta el directorio que tiene `pnpm-workspace.yaml`, o `null`. */
function findMonorepoRoot(from: string): string | null {
  let current = from;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return null;
}

const REPO_ROOT = findMonorepoRoot(import.meta.dirname) ?? join(BACKEND_SRC, '..', '..', '..');
const PLUGINS_DIR = join(REPO_ROOT, 'packages', 'plugins');

/**
 * En un PROYECTO GENERADO los plugins llegan por npm, no como fuente.
 *
 * Este archivo no pertenece a ninguna extensión, así que `project-composer` lo
 * copia como código core. Allá el barrido encontraría sólo los emisores del
 * backend, y todas las excepciones de plugin (las de gift cards, las de contacto,
 * las tres de carrito abandonado) parecerían huérfanas: un test rojo de entrada
 * en cada proyecto de cliente por medir algo que ahí no aplica.
 *
 * El invariante es del MONOREPO —donde vive el fuente de todos los emisores— y
 * por eso se salta afuera, con el mismo criterio que
 * `app-settings/descriptors/manifest-drift.test.ts`.
 */
const IS_MONOREPO = existsSync(PLUGINS_DIR);
const SKIP = IS_MONOREPO
  ? false
  : 'invariante del monorepo: afuera los emisores de plugin llegan por npm, no como fuente';

/**
 * `payload/` se saltea a propósito: es el ESPEJO que `project-composer` copia a
 * los proyectos nuevos. Contarlo duplicaría cada emisor y, peor, un espejo
 * atrasado metería claves que ya no existen.
 */
const SKIP_DIRS = new Set(['node_modules', '.medusa', 'dist', 'build', '.git', 'payload']);

function walkTs(dir: string, out: string[] = []): string[] {
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) walkTs(absolute, out);
    // Los `.test.ts` quedan afuera: un test que NOMBRA una clave no la emite.
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) out.push(absolute);
  }
  return out;
}

/**
 * Los directorios que se barren: el backend y el fuente de cada plugin.
 *
 * `packages/plugins` puede NO EXISTIR: este archivo no pertenece a ninguna
 * extensión, así que `project-composer` lo copia como código core a proyectos de
 * cliente, donde los plugins llegan por npm y no como fuente. Un `readdirSync`
 * pelado ahí tira ENOENT y se lleva puesto el archivo de test entero.
 *
 * El guard contra falso verde vive en el test, no acá: si el barrido devuelve
 * poco, la cuenta de call sites lo denuncia.
 */
function sourceRoots(): string[] {
  const roots = [BACKEND_SRC];
  let plugins: ReturnType<typeof readdirSync>;
  try {
    plugins = readdirSync(PLUGINS_DIR, { withFileTypes: true });
  } catch {
    return roots;
  }
  for (const entry of plugins) {
    if (entry.isDirectory()) roots.push(join(PLUGINS_DIR, entry.name, 'src'));
  }
  return roots;
}

const relative = (absolute: string): string =>
  absolute.slice(REPO_ROOT.length + 1).split('\\').join('/');

type Scan = {
  /** clave literal → archivos que la emiten por el canal `email`. */
  literales: Map<string, string[]>;
  /** archivo → el fragmento de `template:` que no se pudo resolver estáticamente. */
  dinamicos: Map<string, string[]>;
  /** Cuántas llamadas a `createNotifications` se vieron en total. */
  callSites: number;
};

/**
 * Encuentra los emisores leyendo el fuente.
 *
 * Se parte el archivo por `createNotifications(` y se mira una ventana de cada
 * llamada. Es deliberadamente tosco —no hay AST acá— y por eso existe el test
 * "guard contra falso verde": si el criterio deja de encontrar llamadas, la
 * lista sale vacía y TODAS las aserciones darían verde por vacío.
 */
function scanEmitters(): Scan {
  const literales = new Map<string, string[]>();
  const dinamicos = new Map<string, string[]>();
  let callSites = 0;

  for (const root of sourceRoots()) {
    for (const file of walkTs(root)) {
      const source = readFileSync(file, 'utf8');
      const chunks = source.split('createNotifications(');
      for (let i = 1; i < chunks.length; i++) {
        callSites++;
        // 1500 caracteres alcanzan para el objeto de la notificación más largo
        // del repo (`gift-card-experience/delivery.ts`) sin tragarse la llamada
        // siguiente.
        const window = chunks[i]!.slice(0, 1500);
        const channel = window.match(/channel:\s*'([a-z]+)'/);
        // Sólo el canal de mail: `whatsapp` y `feed` los resuelven otros
        // providers, con otro catálogo de plantillas.
        if (channel?.[1] !== 'email') continue;

        const literal = window.match(/template:\s*'([a-z0-9_.-]+)'/);
        const key = relative(file);
        if (literal) {
          const list = literales.get(literal[1]!) ?? [];
          list.push(key);
          literales.set(literal[1]!, list);
        } else {
          const raw = window.match(/template[,:]([^\n]*)/)?.[1]?.trim() ?? '(?)';
          const list = dinamicos.get(key) ?? [];
          list.push(raw);
          dinamicos.set(key, list);
        }
      }
    }
  }

  return { literales, dinamicos, callSites };
}

/**
 * Reservada: el envío de prueba del admin empuja subject y html YA renderizados.
 * No es una plantilla, es el bypass — ver `INLINE_TEMPLATE_KEY` en `service.ts`.
 */
const CLAVE_INLINE = '__inline__';

/**
 * Los emisores cuya clave NO es un literal, con las claves que realmente mandan.
 *
 * Se declaran a mano porque resolverlas exige seguir una variable, un ternario o
 * una función de settings — cosas que un escaneo de texto no puede hacer sin
 * mentir. El test de abajo verifica que el CONJUNTO de archivos dinámicos sea
 * exactamente este: si aparece uno nuevo, hay que venir a declararlo.
 */
const EMISORES_DINAMICOS: Record<string, { claves: string[]; porque: string }> = {
  'apps/backend/src/workflows/process-renewal-cycle.ts': {
    claves: ['recurring-renewal-ready', 'recurring-order-failed'],
    porque: 'ternario sobre `result.outcome === "pending_payment"` (línea 521)',
  },
  'apps/backend/src/workflows/invite-company-member.ts': {
    claves: ['company-invite'],
    porque:
      '`getEmailTemplateSettings().companyInviteTemplateId`, cuyo default es la cadena "company-invite"',
  },
  'apps/backend/src/workflows/invite-corporate-member.ts': {
    claves: ['corporate-invite'],
    porque:
      '`getEmailTemplateSettings().corporateInviteTemplateId`, cuyo default es la cadena "corporate-invite"',
  },
  'packages/plugins/plugin-abandoned-cart/src/workflows/notify-abandoned-cart.ts': {
    claves: ['cart-abandoned-1', 'cart-abandoned-2', 'cart-abandoned-3'],
    porque: '`plan.emailTemplate`, que sale de `abandoned-cart/config.ts` (un paso por escalón)',
  },
  'packages/plugins/plugin-gift-cards/src/modules/gift-card-experience/delivery.ts': {
    claves: ['gift-card-delivery', 'gift-card-resend', 'gift-card-delivery-failed-buyer'],
    porque: 'la clave llega como parámetro de la función local `send()`',
  },
  'apps/backend/src/scripts/test-email.ts': {
    claves: [],
    porque:
      'script de CLI: la clave es un argumento del operador, no un emisor de la aplicación',
  },
};

/**
 * Claves que se emiten por mail y NO tienen plantilla en el código.
 *
 * NO SON TODAS IGUAL DE GRAVES, y la diferencia es el campo `respaldo`:
 *
 *   'seed'      el seed (`scripts/seed-email-templates.ts`) crea la fila. En una
 *               instalación seedeada el mail SALE. El riesgo es la instalación
 *               que no corrió el seed o que borró la fila.
 *   'ninguno'   no hay plantilla de código NI fila en el seed. El mail NO SALE,
 *               punto. Hoy es inocuo sólo porque la feature está apagada.
 *
 * El default de este test es FALLAR: una clave nueva sin plantilla se cae en CI
 * en vez de aparecer como un mail que nadie recibió. Sumarla acá es una
 * decisión, no un olvido.
 */
const SIN_PLANTILLA_DE_CODIGO: Record<string, { respaldo: 'seed' | 'ninguno'; nota: string }> = {
  // ── B2B / corporate ────────────────────────────────────────────────────────
  'company-register-admin': { respaldo: 'seed', nota: 'copia interna del alta de empresa' },
  'corporate-register': { respaldo: 'seed', nota: 'acuse de la solicitud corporativa' },
  'corporate-register-admin': { respaldo: 'seed', nota: 'copia interna de la solicitud corporativa' },
  'company-invite': {
    respaldo: 'ninguno',
    nota:
      'el default de `COMPANY_INVITE_SENDGRID_TEMPLATE_ID` es la cadena "company-invite", que no es ' +
      'un id dinámico de SendGrid (esos empiezan con "d-") ni una clave con plantilla. Y el id ' +
      'dinámico tampoco entraría por acá: `send()` lo lee de `resolved.templateId`, que sólo puede ' +
      'devolver una plantilla de CÓDIGO — no de la clave de la notificación',
  },
  'corporate-invite': { respaldo: 'ninguno', nota: 'gemelo exacto de `company-invite`' },

  // ── formulario de contacto (plugin-contact) ────────────────────────────────
  'contact-received': { respaldo: 'seed', nota: 'acuse al remitente del formulario' },
  'contact-notification-admin': { respaldo: 'seed', nota: 'copia interna del formulario' },

  // ── compras recurrentes (las 7) ────────────────────────────────────────────
  'recurring-order-created': { respaldo: 'seed', nota: 'alta de la suscripción' },
  'recurring-order-generated': { respaldo: 'seed', nota: 'pedido generado por la renovación' },
  'recurring-order-paused': { respaldo: 'seed', nota: 'pausa pedida por el cliente' },
  'recurring-order-cancelled': { respaldo: 'seed', nota: 'baja pedida por el cliente' },
  'recurring-order-failed': { respaldo: 'seed', nota: 'la renovación necesita atención' },
  'recurring-renewal-reminder': { respaldo: 'seed', nota: 'recordatorio de pago' },
  'recurring-renewal-ready': { respaldo: 'seed', nota: 'lista para confirmar' },

  // ── gift cards (plugin-gift-cards) ─────────────────────────────────────────
  // Las cinco: sin plantilla de código Y sin fila en el seed. El día que se
  // prenda la feature, ninguna gift card se entrega y la fila de `notification`
  // dice `success`.
  'gift-card-delivery': { respaldo: 'ninguno', nota: 'entrega de la gift card al destinatario' },
  'gift-card-resend': { respaldo: 'ninguno', nota: 'reenvío manual desde el admin' },
  'gift-card-delivery-failed-buyer': { respaldo: 'ninguno', nota: 'aviso al comprador tras el dead-letter' },
  'gift-card-expiring': { respaldo: 'ninguno', nota: 'aviso de vencimiento próximo' },
  'gift-card-balance-reminder': { respaldo: 'ninguno', nota: 'recordatorio de saldo' },
};

/**
 * Plantillas de código que HOY no emite nadie por el canal de mail.
 *
 * Es el lado espejo del ratchet y no es simétrico: una plantilla sin emisor no
 * rompe nada, sólo pesa. Se listan para que se vea el costo de dejarlas y para
 * que nadie las borre creyendo que sobran cuando en realidad la emite otro canal.
 */
const PLANTILLAS_SIN_EMISOR_DE_MAIL: Record<string, string> = {
  'order-tracking': 'la emiten los subscribers de tracking por el canal `whatsapp`',
  'order-cancelled': 'la emite `order-cancelled-whatsapp.ts` por el canal `whatsapp`',
  'quotation-notification-admin': 'sin emisor en todo el repo: la feature de cotizaciones no está cableada',
  'quotation-rejected-admin': 'sin emisor en todo el repo: gemela de la anterior',
  'kit-cde-notification': 'sin emisor en todo el repo',
  'stock-sync-report': 'sin emisor en todo el repo',
};

/** Las claves que `modules/email/templates/index.ts` sabe renderizar. */
function clavesConPlantillaDeCodigo(): Set<string> {
  const source = readFileSync(join(import.meta.dirname, 'email', 'templates', 'index.ts'), 'utf8');
  const start = source.indexOf('export const templates');
  assert.ok(start > -1, 'no se encontró el mapa `templates` en modules/email/templates/index.ts');
  const body = source.slice(start);
  return new Set([...body.matchAll(/^\s*'([a-z0-9-]+)':/gm)].map((m) => m[1]!));
}

/**
 * Se calculan una vez, y SÓLO en el monorepo.
 *
 * Afuera, los archivos que leen pueden no existir —un proyecto sin la extensión
 * `email-templates` no tiene `modules/email/service.ts` ni su `templates/`—, y un
 * `readFileSync` de nivel superior tira ENOENT ANTES de que el `skip` de cada
 * test llegue a correr: se llevaría puesto el archivo entero.
 */
const scan: Scan = IS_MONOREPO
  ? scanEmitters()
  : { literales: new Map(), dinamicos: new Map(), callSites: 0 };
const conCodigo = IS_MONOREPO ? clavesConPlantillaDeCodigo() : new Set<string>();

/** Todo lo que se emite por mail: literales encontrados + dinámicos declarados. */
const emitidas = new Set<string>([
  ...[...scan.literales.keys()].filter((k) => k !== CLAVE_INLINE),
  ...Object.values(EMISORES_DINAMICOS).flatMap((e) => e.claves),
]);

// ── Guards contra falso verde ───────────────────────────────────────────────────

test({ skip: SKIP }, 'el escaneo encuentra emisores (guard contra falso verde por vacío)', () => {
  // Sin esto, cualquier cambio que rompa el criterio de búsqueda —renombrar
  // `createNotifications`, mover los plugins, agregar un directorio a SKIP_DIRS—
  // dejaría este archivo entero en verde sin revisar una sola clave.
  assert.ok(
    scan.callSites >= 30,
    `sólo ${scan.callSites} llamadas a createNotifications: el criterio de búsqueda se rompió`,
  );
  assert.ok(
    scan.literales.size >= 20,
    `sólo ${scan.literales.size} claves literales por el canal email: el criterio se rompió`,
  );
  assert.ok(conCodigo.size >= 15, `sólo ${conCodigo.size} plantillas de código: el parseo se rompió`);
});

// ── El ratchet ──────────────────────────────────────────────────────────────────

test({ skip: SKIP }, 'toda clave emitida por mail tiene plantilla de código o una excepción con motivo', () => {
  const huerfanas = [...emitidas].filter(
    (k) => !conCodigo.has(k) && !(k in SIN_PLANTILLA_DE_CODIGO),
  ).sort();

  assert.deepEqual(
    huerfanas,
    [],
    `estas claves se emiten por el canal email y NO tienen plantilla en el código: ` +
      `${huerfanas.join(', ')}.\n` +
      'El mail NO SALE y la fila de `notification` igual queda en status="success": nadie se ' +
      'entera. Dos salidas honestas: agregar la plantilla en modules/email/templates/index.ts, ' +
      'o agregar la clave a SIN_PLANTILLA_DE_CODIGO declarando si la respalda el seed o nada.',
  );
});

test({ skip: SKIP }, 'las excepciones siguen sin plantilla de código (una excepción vencida tapa el próximo hueco)', () => {
  const mentiras = Object.keys(SIN_PLANTILLA_DE_CODIGO).filter((k) => conCodigo.has(k));
  assert.deepEqual(
    mentiras,
    [],
    `estas claves ya tienen plantilla de código y siguen exceptuadas: ${mentiras.join(', ')}. ` +
      'Sacalas de SIN_PLANTILLA_DE_CODIGO.',
  );
});

test({ skip: SKIP }, 'las excepciones siguen siendo claves que alguien emite', () => {
  // Una excepción que sobrevive a su emisor es ruido que hace parecer más grande
  // el problema de lo que es, y esconde el día que la clave vuelva de verdad.
  const fantasmas = Object.keys(SIN_PLANTILLA_DE_CODIGO).filter((k) => !emitidas.has(k));
  assert.deepEqual(
    fantasmas,
    [],
    `estas excepciones ya no las emite nadie: ${fantasmas.join(', ')}. Borralas.`,
  );
});

test({ skip: SKIP }, 'el piso medido no se movió sin que nadie lo decida', () => {
  // El número exacto importa: 19 claves emitidas sin respaldo de código es la
  // deuda real medida el 2026-09-03. Si baja, hay que bajarlo acá y celebrarlo;
  // si sube, alguien agregó un emisor sin plantilla y este test lo dice.
  assert.equal(
    Object.keys(SIN_PLANTILLA_DE_CODIGO).length,
    19,
    'cambió la cantidad de claves sin plantilla de código: actualizá el número y el comentario',
  );
});

// ── Los emisores dinámicos ──────────────────────────────────────────────────────

test({ skip: SKIP }, 'todo emisor con clave no literal está declarado, con sus claves', () => {
  const encontrados = [...scan.dinamicos.keys()].sort();
  const declarados = Object.keys(EMISORES_DINAMICOS).sort();
  assert.deepEqual(
    encontrados,
    declarados,
    'la lista de emisores con clave dinámica cambió. Un emisor que arma la clave en runtime no ' +
      'lo puede resolver el escaneo: hay que declarar acá qué claves manda, o el ratchet lo ' +
      'ignora en silencio.\n' +
      `encontrados: ${encontrados.join(', ')}\ndeclarados: ${declarados.join(', ')}`,
  );
});

// ── El lado espejo: plantillas sin emisor ───────────────────────────────────────

test({ skip: SKIP }, 'toda plantilla de código o la emite alguien, o está declarada como sin emisor', () => {
  const muertas = [...conCodigo].filter(
    (k) => !emitidas.has(k) && !(k in PLANTILLAS_SIN_EMISOR_DE_MAIL),
  ).sort();
  assert.deepEqual(
    muertas,
    [],
    `estas plantillas de código no las emite nadie por mail: ${muertas.join(', ')}. ` +
      'Declaralas en PLANTILLAS_SIN_EMISOR_DE_MAIL con el motivo (puede ser que las emita ' +
      'otro canal) o borralas.',
  );
});

test({ skip: SKIP }, 'las plantillas declaradas sin emisor siguen sin emisor', () => {
  const revividas = Object.keys(PLANTILLAS_SIN_EMISOR_DE_MAIL).filter((k) => emitidas.has(k));
  assert.deepEqual(
    revividas,
    [],
    `estas plantillas ya tienen emisor de mail y siguen declaradas como muertas: ` +
      `${revividas.join(', ')}.`,
  );
});

// ── El desplegable del admin ────────────────────────────────────────────────────

/**
 * El catálogo de `admin/lib/email-events-catalog.ts` es lo que el operador VE en
 * el desplegable de claves. Una clave ahí que nadie emite es una fábrica de
 * plantillas muertas: se edita, se publica, y no se dispara nunca — sin ningún
 * error, que es el modo de falla de todo este módulo.
 */
/**
 * Los comentarios NO cuentan, y no es una sutileza.
 *
 * El comentario que documenta por qué `password-reset` pasó de `wired: false` a
 * `wired: true` CITA la forma vieja — como todos los de este módulo. Sin este
 * filtro, el propio comentario que explica el arreglo hace fallar el test que lo
 * protege, y el arreglo obvio (borrar el comentario) es exactamente el peor.
 * Mismo criterio y mismo motivo que `email/db-template-pick.test.ts`.
 */
const sinComentarios = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[^\n'"`]*\/\/.*$/gm, '');

function catalogoDelAdmin(): { claves: string[]; wired: Map<string, boolean> } {
  const source = sinComentarios(
    readFileSync(join(import.meta.dirname, '..', 'admin', 'lib', 'email-events-catalog.ts'), 'utf8'),
  );
  const claves = [...source.matchAll(/\b(?:USER|ADMIN)\('([a-z0-9.-]+)'/g)].map((m) => m[1]!);

  // `wired` por EVENTO: se lee el bloque de cada evento hasta el siguiente.
  const wired = new Map<string, boolean>();
  const bloques = source.split(/\n  \{\n/).slice(1);
  for (const bloque of bloques) {
    const flag = /wired:\s*(true|false)/.exec(bloque);
    if (!flag) continue;
    for (const m of bloque.matchAll(/\b(?:USER|ADMIN)\('([a-z0-9.-]+)'/g)) {
      wired.set(m[1]!, flag[1] === 'true');
    }
  }
  return { claves, wired };
}

/**
 * Claves ofrecidas en el admin que NO emite nadie por mail, con el motivo.
 *
 * `gift-card-issued` SALIÓ de acá el 2026-09-03: no era una excepción, era una
 * clave que no existía en ninguna otra parte del repo. El plugin de gift cards
 * emite `gift-card-delivery`, `-resend`, `-delivery-failed-buyer`, `-expiring` y
 * `-balance-reminder`, y ninguna estaba en el desplegable. El catálogo ofrecía
 * exactamente la clave equivocada.
 */
const EN_EL_ADMIN_SIN_EMISOR_DE_MAIL: Record<string, string> = {
  'order-tracking': 'la emite el canal `whatsapp`; la fila de mail es editable pero no dispara',
  'order-cancelled': 'ídem: el emisor vivo es `order-cancelled-whatsapp.ts`',
  'quotation-notification-admin': 'la feature de cotizaciones no está cableada (wired: false)',
  'quotation-rejected-admin': 'ídem',
  'kit-cde-notification': 'operacional sin emisor (wired: false)',
  'stock-sync-report': 'operacional sin emisor (wired: false)',
};

test({ skip: SKIP }, 'el desplegable del admin no ofrece claves que nadie emite', () => {
  const { claves } = catalogoDelAdmin();
  assert.ok(claves.length > 20, `esperaba las claves del catálogo, encontré ${claves.length}`);
  const muertas = claves
    .filter((k) => !emitidas.has(k) && !(k in EN_EL_ADMIN_SIN_EMISOR_DE_MAIL))
    .sort();
  assert.deepEqual(
    muertas,
    [],
    `el admin ofrece estas claves y ningún código las emite: ${muertas.join(', ')}. ` +
      'El operador puede editarlas y publicarlas, y no se disparan nunca. Sacalas del catálogo, ' +
      'cableá el emisor, o declaralas en EN_EL_ADMIN_SIN_EMISOR_DE_MAIL con el motivo.',
  );
});

// ── Lo que un test no puede ver: el runtime del cliente ─────────────────────────

/**
 * El ratchet de arriba cubre el repo. NO cubre la instalación del cliente, donde
 * la plantilla vive en `email_template` y puede no estar publicada, estar
 * scopeada a otra tienda o haberse borrado. Para ESE caso el único mecanismo es
 * el log — y por eso se verifica que siga existiendo y que siga estando
 * throttleado.
 */
const EMAIL_SERVICE = IS_MONOREPO
  ? readFileSync(join(import.meta.dirname, 'email', 'service.ts'), 'utf8')
  : '';

test({ skip: SKIP }, 'el descarte por falta de plantilla se loguea, y el log dice que el mail no salió', () => {
  const resolve = EMAIL_SERVICE.slice(
    EMAIL_SERVICE.indexOf('private async resolveContent'),
    EMAIL_SERVICE.indexOf('private warnTemplateMissing'),
  );
  assert.ok(resolve.length > 0, 'no se encontró resolveContent ni warnTemplateMissing');
  assert.match(
    resolve,
    /this\.warnTemplateMissing\(key, siteId\)/,
    'volvió el warn genérico: "No template found for: x" no dice que un mail se perdió',
  );

  const warn = EMAIL_SERVICE.slice(EMAIL_SERVICE.indexOf('private warnTemplateMissing'));
  assert.match(warn, /this\.logger\.warn\(/);
  assert.match(warn, /NO SE ENVIÓ/, 'el log tiene que decir la consecuencia, no el síntoma');
});

test({ skip: SKIP }, 'el warn de plantilla ausente está throttleado y por (clave, tienda)', () => {
  // `order.placed` puede emitir miles de mails por día: un warn por envío tapa el
  // resto del log, y un log que nadie lee vale lo mismo que no tenerlo. La tienda
  // va en la clave porque el diagnóstico cambia por tienda: en la A puede haber
  // fila publicada y en la B no.
  const warn = EMAIL_SERVICE.slice(EMAIL_SERVICE.indexOf('private warnTemplateMissing'));
  assert.match(warn, /const cacheKey = `\$\{key\}::\$\{siteId \?\? ''\}`/);
  assert.match(warn, /MISSING_TEMPLATE_WARN_TTL_MS/);
  assert.match(warn, /this\.warnedMissingTemplate\.set\(cacheKey, now\)/);
  // Mapa propio y no el de `warnTemplateOutOfScope`: son dos diagnósticos
  // distintos y compartir el mapa haría que uno silencie al otro cinco minutos.
  assert.doesNotMatch(warn, /warnedOutOfScope/);
});

test({ skip: SKIP }, '`send()` sigue SIN lanzar cuando no hay plantilla', () => {
  // Es deliberado y no se toca: un mail que no sale no puede tumbar un checkout.
  // Lo que faltaba era que se NOTE, no que explote. Si alguien convierte esto en
  // un throw, el `order.placed` de una tienda sin plantilla rompe la orden.
  const send = EMAIL_SERVICE.slice(EMAIL_SERVICE.indexOf('async send('));
  const guard = send.slice(send.indexOf('if (!resolved)'), send.indexOf('const { subject'));
  assert.ok(guard.length > 0, 'no se encontró el guard de `resolved` en send()');
  assert.match(guard, /return \{\};/, 'el best-effort de este módulo es deliberado');
  assert.doesNotMatch(guard, /throw/, 'un mail que no sale no puede tumbar un checkout');
});

test({ skip: SKIP }, '`wired` dice la verdad: lo marcado como cableado tiene emisor', () => {
  // `password-reset` estaba en `wired: false` teniendo emisor vivo desde
  // `subscribers/password-reset-email.ts`, y `gift-card-issued` en `wired: true`
  // sin ningún emisor. Las dos mentiras en direcciones opuestas, y las dos las
  // paga el operador: una lo desanima de editar una plantilla que sí sirve, la
  // otra lo hace editar una que no se dispara.
  const { wired } = catalogoDelAdmin();
  const mienten: string[] = [];
  for (const [clave, esta] of wired) {
    const emite = emitidas.has(clave);
    if (esta && !emite && !(clave in EN_EL_ADMIN_SIN_EMISOR_DE_MAIL)) {
      mienten.push(`${clave}: wired:true pero nadie la emite`);
    }
    if (!esta && emite) {
      mienten.push(`${clave}: wired:false pero SÍ tiene emisor de mail`);
    }
  }
  assert.deepEqual(mienten, [], mienten.join('\n'));
});
