import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Los providers que consumen credenciales por tienda comparten un contrato, y lo que
 * importa de ese contrato es cómo tratan el ERROR.
 *
 * La tentación en los tres es la misma: envolver todo en un try/catch y caer a las
 * credenciales de entorno. Eso convierte "rotó JWT_SECRET" en "despachamos, cobramos
 * y mandamos WhatsApp desde la cuenta de otra tienda", sin un solo error visible. Y
 * ninguna de esas tres acciones se puede deshacer.
 *
 * Se verifica sobre el FUENTE porque instanciar un provider necesita un container de
 * Medusa. Eso obliga a una disciplina: el test busca por MÓDULO, nunca por archivo
 * fijo. La versión anterior grepeaba `service.ts` y se puso roja cuando Correo
 * centralizó la lectura en `site-credentials.ts` — un refactor correcto, porque
 * Correo tiene ~20 call sites y el manejo de error no puede estar copiado en cada
 * uno. Un test que se pone rojo ante una mejora está midiendo la forma, no la regla.
 */

const MODULES = join(import.meta.dirname, '..', '..', 'modules');

const PROVIDERS = [
  { module: 'andreani-fulfillment', label: 'Andreani (cotización)' },
  /**
   * ARCA no es un provider de Medusa —es una carpeta de funciones— pero cumple el
   * mismo contrato y es el caso donde MÁS importa: lo que se hereda de más no es una
   * cuenta de flete sino un certificado X.509 y su clave privada, con los que se
   * firma ante AFIP en nombre de un CUIT. Consultar el padrón como el contribuyente
   * equivocado ya es una identificación falsa ante el fisco, y el mismo par es el
   * que firmaría comprobantes el día que se apunte `ARCA_WSAA_SERVICE` a otro
   * servicio. El test busca por MÓDULO, así que entra sin cambiarle nada.
   */
  { module: 'arca', label: 'ARCA (documentación fiscal)' },
  { module: 'correo-argentino-fulfillment', label: 'Correo Argentino (cotización)' },
  { module: 'kapso-whatsapp', label: 'Kapso (WhatsApp)' },
];

type Source = { name: string; src: string };

/** Los `.ts` propios del módulo, sin tests ni subcarpetas. */
function sourcesOf(moduleDir: string): Source[] {
  return readdirSync(moduleDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.ts') && !e.name.endsWith('.test.ts'))
    .map((e) => ({ name: e.name, src: readFileSync(join(moduleDir, e.name), 'utf8') }));
}

/**
 * El archivo donde el módulo LEE las credenciales de tienda.
 *
 * Todas las ramas del contrato se exigen acá y no repartidas por el módulo: si se
 * permitiera que cada una matcheara en un archivo distinto, un módulo con la lectura
 * en un lado y un `undecryptable` suelto en otro pasaría el test sin que las dos
 * cosas tengan nada que ver.
 */
const readerOf = (sources: Source[]): Source | undefined =>
  sources.find((s) => /readSiteCredentialsViaSql/.test(s.src));

for (const provider of PROVIDERS) {
  const dir = join(MODULES, provider.module);
  const installed = existsSync(dir); // la extensión puede no estar en un proyecto generado

  test(`${provider.label}: lee credenciales por tienda con la conexión del cradle`, () => {
    if (!installed) return;
    const sources = sourcesOf(dir);
    assert.ok(
      readerOf(sources),
      'ningún archivo del módulo llama a readSiteCredentialsViaSql. Es la única vía: ' +
        'el provider recibe un container aislado, sin acceso al de la app.',
    );
    assert.ok(
      sources.some((s) => /PG_CONNECTION/.test(s.src)),
      'nadie resuelve PG_CONNECTION: la lectura no tiene con qué consultar',
    );
  });

  test(`${provider.label}: sin credenciales propias usa las de entorno`, () => {
    if (!installed) return;
    const reader = readerOf(sourcesOf(dir));
    if (!reader) return; // ya falló el test de arriba; no duplicamos el rojo
    // Es lo que permite desplegar sin migrar ninguna tienda.
    //
    // Las dos POLARIDADES valen: unos providers cortan por lo negativo
    // (`if (source !== 'site') return elDelBoot`) y otros por lo positivo
    // (`if (source === 'site') return elDeLaTienda`). Lo que el test exige es que
    // la distinción EXISTA; fijar una sola forma convertía un refactor legítimo en
    // rojo y empujaba a reescribir el código para contentar al grep.
    assert.match(
      reader.src,
      /source (!==|===) 'site'/,
      `${reader.name}: no distingue credenciales propias de las heredadas del entorno`,
    );
  });

  test(`${provider.label}: credenciales ILEGIBLES cortan, no caen al entorno`, () => {
    if (!installed) return;
    const sources = sourcesOf(dir);
    const reader = readerOf(sources);
    if (!reader) return;

    assert.match(
      reader.src,
      /reason === 'undecryptable'/,
      `${reader.name}: no contempla el blob ilegible (JWT_SECRET rotado)`,
    );

    // Y ningún catch de degradación puede tragárselo. Se exige BLOQUE POR BLOQUE, no
    // por archivo: alcanza con que un solo `try` que envuelva la lectura se lo coma
    // para que ese camino despache con la cuenta ajena, y los otros veinte no lo
    // compensan.
    //
    // Por qué el análisis y no un grep del archivo entero: `get-client.ts` degrada,
    // pero su `catch` envuelve sólo la resolución de tienda y la lectura de
    // credenciales pasa DESPUÉS, fuera del `try`. Un grep por archivo lo marcaba en
    // rojo pidiéndole una guarda contra un error que nunca puede atrapar.
    const tainted = credentialTaintedNames(sources);
    for (const s of sources) {
      for (const block of tryCatchBlocks(s.src)) {
        if (!degrades(block.catchBody)) continue;
        if (![...tainted].some((n) => block.tryBody.includes(n))) continue;
        assert.match(
          block.catchBody,
          RETHROWS_UNDECRYPTABLE,
          `${s.name}: el catch de la línea ~${block.line} envuelve una lectura de ` +
            'credenciales y degrada sin re-tirar el error de descifrado, así que ese ' +
            'camino termina operando con la cuenta de otra tienda',
        );
      }
    }
  });

  test(`${provider.label}: un fallo de lectura degrada con aviso`, () => {
    if (!installed) return;
    // Distinto del anterior: si la DB no responde, dejar la instancia sin operar
    // sería peor que seguir con las credenciales que se venían usando. El aviso es
    // la mitad que importa — degradar en silencio es indistinguible de andar bien.
    const sources = sourcesOf(dir);
    assert.ok(
      sources.some((s) => degrades(s.src)),
      'ningún archivo degrada con aviso ante un fallo de lectura: una caída de la DB ' +
        'deja al provider entero sin operar',
    );
  });
}

/**
 * Las dos formas de reconocer el error ilegible valen: comparar el mensaje a mano, o
 * el helper `isUndecryptableCredentialsError()` que Correo extrajo justamente para no
 * repetir el `includes()` en veinte lugares.
 */
const RETHROWS_UNDECRYPTABLE =
  /(no se puede[n]? descifrar'\)|isUndecryptable\w*\(error\))\)? throw error;/;

/** Sin esto, un `try {` citado en un JSDoc desalineaba todo el conteo de llaves. */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');

/** El índice de la llave que cierra la que abre en `open`, o `-1`. */
function matchBrace(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

/**
 * Los pares `try {…} catch (…) {…}` del archivo, con su línea aproximada.
 *
 * Es un scanner de llaves, no un parser. Alcanza porque lo único que necesita
 * distinguir es qué llamadas quedan DENTRO de cada `try`, y para eso el balanceo
 * basta. Los comentarios se quitan antes justamente porque son lo único de este
 * repo que mete llaves desbalanceadas.
 */
function tryCatchBlocks(source: string): { tryBody: string; catchBody: string; line: number }[] {
  const src = stripComments(source);
  const blocks: { tryBody: string; catchBody: string; line: number }[] = [];

  for (const m of src.matchAll(/\btry\s*\{/g)) {
    const openTry = src.indexOf('{', m.index!);
    const closeTry = matchBrace(src, openTry);
    if (closeTry === -1) continue;

    const after = src.slice(closeTry + 1);
    const catchMatch = after.match(/^\s*catch\s*(\([^)]*\))?\s*\{/);
    if (!catchMatch) continue; // `try/finally` sin catch: no degrada nada

    const openCatch = closeTry + 1 + catchMatch[0].lastIndexOf('{');
    const closeCatch = matchBrace(src, openCatch);
    if (closeCatch === -1) continue;

    blocks.push({
      tryBody: src.slice(openTry + 1, closeTry),
      catchBody: src.slice(openCatch + 1, closeCatch),
      line: src.slice(0, m.index!).split('\n').length,
    });
  }
  return blocks;
}

/**
 * Los nombres del módulo por los que puede salir un error de descifrado.
 *
 * Punto fijo a nivel ARCHIVO: si un archivo llama a algo contaminado, todo lo que
 * declara queda contaminado. Es deliberadamente conservador —`correoClientsFor` no
 * lee credenciales pero vive en `get-client.ts`, que sí—, y esa es la dirección
 * segura del error: puede pedir una guarda de más, nunca dejar pasar una de menos.
 * Es lo que atrapa a `loadCorreoOptionsViaPg`, que no menciona credenciales en su
 * nombre pero llama al lector por dentro.
 */
function credentialTaintedNames(sources: Source[]): Set<string> {
  const tainted = new Set(['readSiteCredentialsViaSql']);
  // Anclado a columna 0: sólo declaraciones de nivel de módulo. Sin el ancla, la
  // regex se llevaba puestos los `const` locales de cada función —`normalized`,
  // `creds`, `scope`— y cualquier `try` que mencionara una de esas palabras quedaba
  // marcado como lector de credenciales. Fue exactamente el falso positivo que puso
  // en rojo al `try` que sólo resuelve la tienda.
  const declares = (src: string) => [
    ...src.matchAll(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm),
    ...src.matchAll(/^(?:export\s+)?const\s+(\w+)\s*=/gm),
  ].map((m) => m[1]!);

  for (let pass = 0; pass < sources.length + 1; pass++) {
    const before = tainted.size;
    for (const s of sources) {
      if (![...tainted].some((n) => s.src.includes(n))) continue;
      for (const name of declares(s.src)) tainted.add(name);
    }
    if (tainted.size === before) break;
  }
  return tainted;
}

/**
 * Un archivo que avisa y sigue con la configuración de la instancia.
 *
 * Matchea sobre la PROSA del warning a propósito: ese texto es lo único que ve el
 * operador cuando esto pasa a las tres de la mañana, y un warning que no dice con
 * qué credenciales quedó operando no sirve para nada. Por eso la lista de frases
 * aceptadas es explícita en vez de un `.*`.
 *
 * Las cuatro dicen lo mismo con la precisión de cada provider: Kapso cae a un
 * número de teléfono, Andreani a las credenciales de entorno, y Correo a "la del
 * arranque" —más exacto desde `app-settings`, porque el fallback ya no es puro
 * entorno sino lo que se resolvió al bootear—. Agregar una frase acá es válido;
 * borrarlas para poner un comodín es vaciar el test.
 */
function degrades(src: string): boolean {
  const warns = /logger[_.]?\.?warn\(/.test(src);
  const saysWhichCredentials =
    /Se usan? (las de entorno|el número de entorno|la del arranque|la configuración de la instancia)/.test(
      src,
    );
  return warns && saysWhichCredentials;
}
