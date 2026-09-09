import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveProposalView } from './lib.ts';

/** El formateador real de la pantalla, reducido a lo que importa acá. */
const format = (_field: string, v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

/** El caso del reporte, con los datos reales de la corrida de producción. */
const AI_TEXT =
  'Lata de pintura Alba Antióxido para metales ferrosos, colorado, de 0,5 litros, con logo de la marca Alba y pincel.';
const EDITED_TEXT = 'Lata de pintura Alba Antióxido para metales ferrosos, colorado, de 0,5 litros.';

test('el campo editado muestra el texto del usuario, no el de la IA', () => {
  // Es el bug reportado: guardar la edición y ver volver el texto de la IA.
  const view = resolveProposalView({
    field: 'alt_text',
    proposed: { alt_text: { value: AI_TEXT, confidence: 0.7 } },
    accepted: { alt_text: EDITED_TEXT },
    format,
  });
  assert.equal(view.shownText, EDITED_TEXT);
  assert.equal(view.aiText, AI_TEXT);
  assert.equal(view.effective, EDITED_TEXT);
  assert.equal(view.isEdited, true);
  assert.equal(view.isAccepted, true);
});

test('sin decisión guardada se muestra la propuesta de la IA', () => {
  const view = resolveProposalView({
    field: 'alt_text',
    proposed: { alt_text: { value: AI_TEXT } },
    accepted: {},
    format,
  });
  assert.equal(view.shownText, AI_TEXT);
  assert.equal(view.isAccepted, false);
  assert.equal(view.isEdited, false);
});

test('aceptar la propuesta tal cual NO cuenta como editado', () => {
  // Si contara, la pantalla mostraría el bloque "Propuesta original de la IA"
  // duplicando el mismo texto, y ofrecería descartar una edición inexistente.
  const view = resolveProposalView({
    field: 'subtitle',
    proposed: { subtitle: { value: 'Protección superior' } },
    accepted: { subtitle: 'Protección superior' },
    format,
  });
  assert.equal(view.isAccepted, true);
  assert.equal(view.isEdited, false);
});

test('un array aceptado tal cual tampoco cuenta como editado', () => {
  // La razón de comparar TEXTOS y no referencias: `accepted.keywords` viaja por
  // JSON, así que nunca es la misma instancia que `proposed.keywords.value`.
  const proposedValue = ['protector', 'ferroso', 'base'];
  const view = resolveProposalView({
    field: 'keywords',
    proposed: { keywords: { value: proposedValue } },
    accepted: { keywords: ['protector', 'ferroso', 'base'] },
    format,
  });
  assert.equal(view.isEdited, false, 'un array con los mismos elementos no es una edición');
});

test('un array con elementos distintos sí cuenta como editado', () => {
  const view = resolveProposalView({
    field: 'keywords',
    proposed: { keywords: { value: ['protector', 'ferroso'] } },
    accepted: { keywords: ['protector'] },
    format,
  });
  assert.equal(view.isEdited, true);
  assert.equal(view.shownText, 'protector');
  assert.equal(view.aiText, 'protector, ferroso');
});

test('vaciar un campo a propósito es una edición, no un campo sin decidir', () => {
  // `''` formatea a '—' igual que un valor ausente, pero la CLAVE está en
  // `accepted`: por eso `isAccepted` mira la clave y no el valor. Si mirara el
  // valor, borrar un subtítulo se leería como "todavía no decidiste".
  const view = resolveProposalView({
    field: 'subtitle',
    proposed: { subtitle: { value: 'Protección superior' } },
    accepted: { subtitle: '' },
    format,
  });
  assert.equal(view.isAccepted, true);
  assert.equal(view.isEdited, true);
  assert.equal(view.shownText, '—');
});

test('un campo rechazado no se muestra como aceptado', () => {
  // `rejected_changes` no entra en este cálculo: el campo simplemente no está en
  // `accepted`, así que se ve la propuesta y los botones vuelven al estado inicial.
  const view = resolveProposalView({
    field: 'meta_title',
    proposed: { meta_title: { value: 'Alba Antióxido 0,5 L' } },
    accepted: {},
    format,
  });
  assert.equal(view.isAccepted, false);
  assert.equal(view.shownText, 'Alba Antióxido 0,5 L');
});
