/**
 * Separa un `last_error` del outbox en lo que dijo el ERP y lo que agregamos
 * nosotros.
 *
 * Los mensajes los arman distintos lugares del backend y ninguno tiene un
 * formato fijo, pero comparten una forma: una explicación nuestra seguida del
 * cuerpo crudo que devolvió el ERP, casi siempre JSON. Lo que el operador
 * necesita leer primero es el `message` de ese JSON —"Código de base y/o código
 * de fórmula no válido/s."— y en la tabla quedaba al FINAL, después del texto
 * explicativo. Medido en producción (desdeelsur, 2026-09-23):
 *
 * - `… nunca se había mandado. Motivo del ERP: {"message":"…"}`
 * - `Zeus: error del servidor (HTTP 500) — {"status":"…","errors":[{"message":"…"}]}`
 *
 * No se parsea ninguna frase en particular: se busca el primer `{` que abra un
 * JSON válido hasta el final del texto. Si no hay, el mensaje entero es el
 * resumen y `erpMessage` queda en null.
 */
export type OutboxErrorParts = {
  /** Nuestra explicación, sin el JSON ni el conector que lo presentaba. */
  summary: string;
  /** El `message` que devolvió el ERP, si vino en el cuerpo. */
  erpMessage: string | null;
};

export function splitOutboxError(raw: string | null | undefined): OutboxErrorParts {
  const text = (raw ?? '').trim();
  if (!text) return { summary: '', erpMessage: null };

  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    let body: unknown;
    try {
      body = JSON.parse(text.slice(start));
    } catch {
      continue;
    }
    const erpMessage = messageOf(body);
    if (!erpMessage) break;
    const summary = text
      .slice(0, start)
      .replace(/(Motivo del ERP:|—|-|:)\s*$/u, '')
      .trim();
    return { summary, erpMessage };
  }

  return { summary: text, erpMessage: null };
}

function messageOf(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as { message?: unknown; errors?: unknown };
  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message.trim();
  }
  if (Array.isArray(record.errors)) {
    for (const entry of record.errors) {
      const nested = messageOf(entry);
      if (nested) return nested;
    }
  }
  return null;
}
