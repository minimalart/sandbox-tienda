import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * QUIEN CAMBIA DE TIENDA EN CALIENTE TIENE QUE REMONTAR.
 *
 * El default del admin es RECARGAR el navegador al cambiar de tienda, y está
 * argumentado en `lib/active-site.ts`: el site viaja por header, no entra en las
 * query keys, y media docena de hooks usan claves constantes. `reloadOnChange={false}`
 * es el opt-in para las pantallas que se ganaron el derecho a no recargar.
 *
 * De las tres condiciones que habilitan ese opt-in, dos fallan RUIDOSAMENTE —sin
 * `siteId` en la key ves datos de otra tienda, sin el header ves los globales— y la
 * tercera falla en silencio: si el llamador no remonta con `key={activeId}`, el
 * borrador de la tienda A sobrevive al cambio y el próximo "Guardar" lo escribe
 * contra la B. Sin excepción, sin toast, sin nada. El operador se entera cuando un
 * cliente le pregunta por qué le cambiaron la configuración.
 *
 * Este test es el único guard posible de esa tercera: no hay tipo que la exprese
 * —es una relación entre un componente y su llamador— y el compilador no la ve.
 *
 * Se analiza el FUENTE como texto porque el runner (`node --test`) no puede importar
 * `.tsx`: no entiende JSX. Misma técnica que `site-scope.test.ts`.
 */

/** Los comentarios de este repo CITAN código todo el tiempo. Hay que limpiarlos. */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');

const ADMIN_DIR = join(import.meta.dirname, '..');

const sources = (dir: string, out: { path: string; src: string }[] = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sources(full, out);
    else if (/\.tsx$/.test(entry.name)) {
      out.push({ path: full.slice(ADMIN_DIR.length + 1), src: stripComments(readFileSync(full, 'utf8')) });
    }
  }
  return out;
};

const files = sources(ADMIN_DIR);

/** Pantallas que pidieron el modo caliente, ya sea por la barra o por la franja. */
const softScreens = files.filter(({ src }) => /reloadOnChange=\{false\}/.test(src));

test('hay pantallas en modo caliente (si no, el test no está probando nada)', () => {
  assert.ok(
    softScreens.length > 0,
    'Ningún archivo usa `reloadOnChange={false}`. O se revirtió el opt-in, o el ' +
      'escáner dejó de encontrarlo — en los dos casos este archivo está dando un ' +
      'verde que no significa nada.',
  );
});

test('toda pantalla en modo caliente se remonta con key={activeId}', () => {
  const sinRemonte = softScreens
    .filter(({ src }) => !/key=\{\s*activeId/.test(src))
    .map(({ path }) => path);

  assert.deepEqual(
    sinRemonte,
    [],
    `Estas pantallas piden \`reloadOnChange={false}\` pero no remontan con ` +
      `\`key={activeId …}\`:\n\n  ${sinRemonte.join('\n  ')}\n\n` +
      `Sin el remonte, el estado local sobrevive al cambio de tienda: un borrador ` +
      `cargado con la tienda A se guarda contra la B, sin ningún error.\n` +
      `Precedentes: \`settings/site-credentials\`, \`settings/extension-settings\` y ` +
      `\`comments/settings\`.`,
  );
});

/**
 * SCOPEAR LA KEY Y CONGELAR EL HEADER ES PEOR QUE NO SCOPEAR NADA.
 *
 * Las condiciones 1 y 2 de `SetActiveSiteOptions` van juntas o no van. Un hook que
 * mete el `siteId` en la query key pero manda el header congelado guarda la MISMA
 * respuesta bajo dos claves distintas: react-query se ve sano, la pantalla se ve
 * sana, y el operador cree que está mirando datos por tienda cuando mira los de una
 * sola. Sin la key scopeada al menos el cache viejo se nota.
 *
 * "Header por llamada" NO quiere decir "no usar el sdk" —esa era la regla que este
 * test tenía antes, y era falsa—: `site-credentials` y `app-settings` pegan por
 * `sdk.client.fetch` y están bien, porque pasan `headers: siteHeaders(siteId)` en
 * cada request. Lo que no sirve es apoyarse en el `globalHeaders` del SDK, que
 * `lib/client.ts` resuelve UNA sola vez al construirse: sin recarga queda congelado
 * en la tienda que estaba activa cuando cargó el bundle.
 *
 * Se chequea sobre el hook y no cruzando pantalla→hook a propósito: la relación
 * pantalla→hook necesita resolver imports entre carpetas y da falsos positivos en
 * cuanto dos pantallas hermanas comparten un hook. Un ratchet con falsos positivos
 * se desactiva a la semana.
 */
const HOOKS_DIR = join(ADMIN_DIR, 'hooks', 'api');

const KEY_IS_SITE_SCOPED = /queryKey[^\n]*(siteId|activeId)|QueryKey\(\s*siteId|siteScopedKey/;
const HEADER_PER_CALL = /siteHeaders?\s*\(|from\s+'[^']*lib\/http'/;

test('un hook con key scopeada por tienda resuelve el header por llamada', () => {
  const rotos = readdirSync(HOOKS_DIR)
    .filter((file) => /\.tsx?$/.test(file) && !file.endsWith('.test.ts'))
    .map((file) => ({ file, src: stripComments(readFileSync(join(HOOKS_DIR, file), 'utf8')) }))
    .filter(({ src }) => KEY_IS_SITE_SCOPED.test(src) && !HEADER_PER_CALL.test(src))
    .map(({ file }) => file);

  assert.deepEqual(
    rotos,
    [],
    `Estos hooks scopean su query key por tienda pero no resuelven el header por ` +
      `llamada:\n\n  ${rotos.join('\n  ')}\n\n` +
      `La misma respuesta queda guardada bajo dos claves distintas y la pantalla ` +
      `aparenta datos por tienda que no tiene.\n` +
      `Arreglo: usar el \`fetchJson\` de \`lib/http.ts\`, o pasar \`headers: siteHeaders(siteId)\` ` +
      `en cada llamada del sdk (como \`site-credentials\` y \`app-settings\`).`,
  );
});
