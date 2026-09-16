import { test } from 'node:test';
import assert from 'node:assert/strict';

import { WHATSAPP_SUGGESTED_TEMPLATES } from './whatsapp-suggested-templates';
import { WHATSAPP_EVENT_BY_KEY } from './whatsapp-events-catalog';
import { whatsappTemplates } from '../../modules/kapso-whatsapp/templates';
import type { KapsoSettings } from '../../modules/kapso-whatsapp/settings';

/**
 * El contrato de las plantillas SUGERIDAS: son el contenido que el operador crea
 * en Kapso de un botón, así que lo que declaran acá es lo que Meta va a aprobar.
 *
 * ── EL MODO DE FALLA QUE ESTE ARCHIVO CIERRA ─────────────────────────────────
 *
 * Meta rechaza el envío entero si la cantidad de parámetros no coincide con la
 * de la plantilla aprobada. El error llega del lado de Kapso, en un log del
 * backend, cuando el mensaje ya no salió: nadie se entera salvo que alguien esté
 * mirando. Y hay DOS fuentes que pueden discrepar con el body sugerido:
 *
 *   1. los `example` de la propia sugerencia (Meta los exige, uno por {{n}});
 *   2. el builder de `kapso-whatsapp/templates/index.ts`, que es el fallback que
 *      corre cuando NO hay binding publicado en el admin.
 *
 * El (2) es el que muerde: el toggle "Publicar" del modal de creación viene en
 * OFF, así que asignar el evento deja el binding en borrador y el envío cae al
 * fallback sin que nadie lo haya decidido.
 */

/** Los `{{n}}` del body, en orden de aparición. */
function placeholdersOf(body: string): number[] {
  return [...body.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => Number(m[1]));
}

/**
 * Cuántos parámetros manda el builder de código para ese evento.
 *
 * Los builders son funciones puras de `(data, settings)`, así que se los puede
 * llamar con una config completa y CONTAR. Es exacto: no adivina leyendo el
 * fuente.
 */
function codeParamCount(eventKey: string): number | null {
  const builder = whatsappTemplates[eventKey];
  if (!builder) return null;
  // Todos los nombres poblados: los builders opcionales devuelven `null` cuando
  // el ajuste está vacío, y acá se quiere contar el caso en que SÍ manda.
  const templates = new Proxy({}, { get: () => 'template_de_prueba' });
  const payload = builder({}, { templateLang: 'es', templates } as unknown as KapsoSettings);
  if (!payload) return null;
  const body = payload.components?.find((c) => c.type === 'body') as
    | { parameters?: unknown[] }
    | undefined;
  return body?.parameters?.length ?? 0;
}

/**
 * Sugerencias cuyo body NO tiene la misma cantidad de variables que el fallback
 * de código, con el motivo. Una entrada acá es una decisión, no un olvido: la
 * plantilla EXIGE binding publicado para funcionar.
 */
const PARIDAD_EXCEPTUADA: Record<string, string> = {
  cart_abandoned_1:
    'el copy acordado con el equipo usa 2 variables (nombre, link) y el builder manda 3 ' +
    '(nombre, total, link). Exige publicar el binding desde el admin: en borrador corre el ' +
    'fallback y Meta rechaza el envío',
};

// ── Guard contra falso verde ────────────────────────────────────────────────────

test('hay sugerencias que revisar', () => {
  assert.ok(
    WHATSAPP_SUGGESTED_TEMPLATES.length >= 5,
    `sólo ${WHATSAPP_SUGGESTED_TEMPLATES.length} sugerencias: el import se rompió`,
  );
});

// ── Lo que Meta exige del contenido ─────────────────────────────────────────────

test('los placeholders son {{1}}..{{n}} consecutivos y sin repetir', () => {
  // Meta rechaza la creación de la plantilla si hay un salto o si el body empieza
  // en {{2}}. El error se ve recién al crearla, no al escribirla.
  const rotos: string[] = [];
  for (const suggestion of WHATSAPP_SUGGESTED_TEMPLATES) {
    const found = placeholdersOf(suggestion.body);
    const expected = Array.from({ length: found.length }, (_, i) => i + 1);
    if (JSON.stringify(found) !== JSON.stringify(expected)) {
      rotos.push(`${suggestion.name}: ${JSON.stringify(found)} en vez de ${JSON.stringify(expected)}`);
    }
  }
  assert.deepEqual(rotos, [], rotos.join('\n'));
});

test('cada placeholder tiene su ejemplo, y no sobran', () => {
  const rotos: string[] = [];
  for (const suggestion of WHATSAPP_SUGGESTED_TEMPLATES) {
    const count = placeholdersOf(suggestion.body).length;
    if (suggestion.example.length !== count) {
      rotos.push(
        `${suggestion.name}: ${count} placeholder(s) y ${suggestion.example.length} ejemplo(s)`,
      );
    }
    for (const [i, value] of suggestion.example.entries()) {
      if (!value.trim()) rotos.push(`${suggestion.name}: el ejemplo de {{${i + 1}}} está vacío`);
    }
  }
  assert.deepEqual(rotos, [], rotos.join('\n'));
});

test('el nombre es el que Meta acepta y no se repite', () => {
  // Mismo patrón que el descriptor de app-settings: minúsculas, números y guión
  // bajo. Un nombre con mayúscula o guión medio lo rechaza la API.
  const vistos = new Set<string>();
  const rotos: string[] = [];
  for (const { name } of WHATSAPP_SUGGESTED_TEMPLATES) {
    if (!/^[a-z0-9_]+$/.test(name)) rotos.push(`${name}: no matchea ^[a-z0-9_]+$`);
    if (vistos.has(name)) rotos.push(`${name}: duplicado`);
    vistos.add(name);
  }
  assert.deepEqual(rotos, [], rotos.join('\n'));
});

// ── El puente con el resto del módulo ───────────────────────────────────────────

test('el evento sugerido existe en el catálogo, y su label es la del catálogo', () => {
  // Una sugerencia que apunta a un evento inexistente ofrece una asignación que
  // el desplegable no tiene: el operador crea la plantilla y no la puede atar a
  // nada.
  const rotos: string[] = [];
  for (const { name, eventKey, eventLabelKey } of WHATSAPP_SUGGESTED_TEMPLATES) {
    const event = WHATSAPP_EVENT_BY_KEY[eventKey];
    if (!event) {
      rotos.push(`${name}: el evento '${eventKey}' no está en WHATSAPP_EVENTS`);
      continue;
    }
    if (event.labelKey !== eventLabelKey) {
      rotos.push(`${name}: eventLabelKey '${eventLabelKey}' vs '${event.labelKey}' del catálogo`);
    }
  }
  assert.deepEqual(rotos, [], rotos.join('\n'));
});

test('las variables que el evento ofrece alcanzan para el body sugerido', () => {
  const rotos: string[] = [];
  for (const suggestion of WHATSAPP_SUGGESTED_TEMPLATES) {
    const event = WHATSAPP_EVENT_BY_KEY[suggestion.eventKey];
    if (!event) continue;
    const count = placeholdersOf(suggestion.body).length;
    if (event.variables.length < count) {
      rotos.push(
        `${suggestion.name}: el body pide ${count} variable(s) y el evento ofrece ` +
          `${event.variables.length} para mapear`,
      );
    }
  }
  assert.deepEqual(rotos, [], rotos.join('\n'));
});

// ── El ratchet: la paridad con el fallback de código ────────────────────────────

test('el body sugerido tiene tantas variables como manda el fallback de código', () => {
  const rotos: string[] = [];
  for (const suggestion of WHATSAPP_SUGGESTED_TEMPLATES) {
    const esperado = codeParamCount(suggestion.eventKey);
    if (esperado === null) continue;
    const count = placeholdersOf(suggestion.body).length;
    if (count !== esperado && !(suggestion.name in PARIDAD_EXCEPTUADA)) {
      rotos.push(
        `${suggestion.name}: el body usa ${count} variable(s) y el builder de ` +
          `'${suggestion.eventKey}' manda ${esperado}`,
      );
    }
  }
  assert.deepEqual(
    rotos,
    [],
    `${rotos.join('\n')}\n\nMeta rechaza el envío cuando los números no coinciden, y el error ` +
      'sólo queda en un log. Dos salidas honestas: emparejar el body con el builder, o declarar ' +
      'la sugerencia en PARIDAD_EXCEPTUADA con el motivo (y entonces EXIGE binding publicado).',
  );
});

test('las excepciones de paridad siguen sin paridad', () => {
  // Una excepción vencida hace parecer frágil algo que ya se arregló, y tapa el
  // día que el desbalance vuelva de verdad.
  const mentiras: string[] = [];
  for (const name of Object.keys(PARIDAD_EXCEPTUADA)) {
    const suggestion = WHATSAPP_SUGGESTED_TEMPLATES.find((s) => s.name === name);
    if (!suggestion) {
      mentiras.push(`${name}: ya no existe como sugerencia`);
      continue;
    }
    const esperado = codeParamCount(suggestion.eventKey);
    if (esperado !== null && placeholdersOf(suggestion.body).length === esperado) {
      mentiras.push(`${name}: ya tiene paridad con el builder — sacala de PARIDAD_EXCEPTUADA`);
    }
  }
  assert.deepEqual(mentiras, [], mentiras.join('\n'));
});
