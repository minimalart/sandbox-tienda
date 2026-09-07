import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settingsNamespaces } from './index.ts';

/**
 * Una variable de entorno la EDITA un solo namespace.
 *
 * `manifest-drift.test.ts` ya prohíbe que dos descriptores del MISMO namespace
 * declaren la misma env. Lo que no miraba nadie es el cruce ENTRE namespaces, y ahí
 * está el problema de verdad: al migrar la cola larga aparecieron variables que leen
 * cuatro extensiones distintas. Si cada una la declara por su lado, todo compila y
 * todos los tests pasan — y el resultado son cuatro cards editando el mismo valor.
 *
 * El síntoma no es un error. El operador cambia el modelo de IA en la pantalla del
 * asistente, entra a la de landings y lo ve distinto; o lo cambia ahí también y pisa
 * lo que acababa de guardar, sin que nada le avise que era el mismo campo.
 *
 * La regla, documentada en `docs/recipes/migrar-env-vars-a-app-settings.md`: un
 * dueño con descriptor editable, y los demás la declaran en `envOnly` con un
 * `reason` que lo nombre. `envOnly` repetido está BIEN y es lo que este test espera
 * — es la forma de decir "acá se lee, pero se configura en otro lado".
 */

type Claim = { namespace: string; key: string };

/** Quién declara cada env var como EDITABLE. Los `envOnly` no cuentan acá. */
function editableClaims(): Map<string, Claim[]> {
  const claims = new Map<string, Claim[]>();
  for (const ns of settingsNamespaces) {
    for (const descriptor of ns.settings) {
      for (const envVar of descriptor.env) {
        const list = claims.get(envVar) ?? [];
        list.push({ namespace: ns.namespace, key: descriptor.key });
        claims.set(envVar, list);
      }
    }
  }
  return claims;
}

test('ninguna env var es editable desde dos namespaces', () => {
  const problems: string[] = [];

  for (const [envVar, claims] of editableClaims()) {
    if (claims.length < 2) continue;
    problems.push(
      `${envVar}: la declaran como editable ` +
        `${claims.map((c) => `${c.namespace}/${c.key}`).join(' y ')}. ` +
        'Elegí un dueño y que el resto la declare en envOnly apuntando a él.',
    );
  }

  assert.deepEqual(problems, [], `\n  - ${problems.join('\n  - ')}\n`);
});

test('un envOnly no puede contradecir a un descriptor del mismo namespace', () => {
  // Declararla en los dos lados es una migración a medias: la card la muestra como
  // editable Y como "sólo por entorno" a la vez. Gana el descriptor, así que el
  // bloque de envOnly le miente al operador sobre si puede cambiarla.
  const problems: string[] = [];

  for (const ns of settingsNamespaces) {
    const editable = new Set(ns.settings.flatMap((d) => d.env));
    for (const entry of ns.envOnly ?? []) {
      if (editable.has(entry.key)) {
        problems.push(
          `${ns.namespace}: ${entry.key} está en envOnly Y en un descriptor. ` +
            'Dejá una sola de las dos.',
        );
      }
    }
  }

  assert.deepEqual(problems, [], `\n  - ${problems.join('\n  - ')}\n`);
});

test('todo envOnly explica por qué, y a quién apuntar si es compartida', () => {
  const editableSomewhere = new Set(
    settingsNamespaces.flatMap((n) => n.settings.flatMap((d) => d.env)),
  );
  const problems: string[] = [];

  for (const ns of settingsNamespaces) {
    for (const entry of ns.envOnly ?? []) {
      // La razón es lo que la UI muestra en lugar del campo. Una vacía deja al
      // operador viendo un nombre de variable y nada más.
      if (!entry.reason?.trim()) {
        problems.push(`${ns.namespace}/${entry.key}: envOnly sin reason`);
        continue;
      }
      // Y si la variable SÍ es editable en otro lado, la razón tiene que decir
      // dónde. "No se gestiona desde acá" sin decir dónde sí es una pared.
      if (editableSomewhere.has(entry.key) && entry.reason.length < 20) {
        problems.push(
          `${ns.namespace}/${entry.key}: es editable en otro namespace, pero su ` +
            `reason ("${entry.reason}") no alcanza para decir dónde configurarla.`,
        );
      }
    }
  }

  assert.deepEqual(problems, [], `\n  - ${problems.join('\n  - ')}\n`);
});
