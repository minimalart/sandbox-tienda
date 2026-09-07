import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isFloatingButtonLive,
  mergeFloatingButtonConfig,
  normalizeWhatsappPhone,
  WHATSAPP_FLOATING_BUTTON_DEFAULTS,
} from './floating-button';

test('normalizeWhatsappPhone deja solo dígitos', () => {
  assert.equal(normalizeWhatsappPhone('+54 9 11 5555-5555'), '5491155555555');
  assert.equal(normalizeWhatsappPhone('(011) 4444 3333'), '01144443333');
});

test('normalizeWhatsappPhone saca el prefijo internacional 00', () => {
  assert.equal(normalizeWhatsappPhone('0054 11 5555 5555'), '541155555555');
});

test('normalizeWhatsappPhone descarta lo que no alcanza a ser un número', () => {
  assert.equal(normalizeWhatsappPhone('1234567'), '');
  assert.equal(normalizeWhatsappPhone('sin teléfono'), '');
  assert.equal(normalizeWhatsappPhone(undefined), '');
  assert.equal(normalizeWhatsappPhone(null), '');
});

test('normalizeWhatsappPhone corta en el largo máximo de E.164', () => {
  assert.equal(normalizeWhatsappPhone('1'.repeat(20)).length, 15);
});

test('mergeFloatingButtonConfig completa los defaults', () => {
  assert.deepEqual(mergeFloatingButtonConfig({}), WHATSAPP_FLOATING_BUTTON_DEFAULTS);
  assert.deepEqual(mergeFloatingButtonConfig(null), WHATSAPP_FLOATING_BUTTON_DEFAULTS);
});

test('mergeFloatingButtonConfig acepta el toggle como boolean o string', () => {
  assert.equal(mergeFloatingButtonConfig({ enabled: true }).enabled, true);
  assert.equal(mergeFloatingButtonConfig({ enabled: 'true' }).enabled, true);
  assert.equal(mergeFloatingButtonConfig({ enabled: 'sí' }).enabled, false);
});

test('mergeFloatingButtonConfig permite vaciar el mensaje pero no el label', () => {
  assert.equal(mergeFloatingButtonConfig({ message: '   ' }).message, '');
  assert.equal(
    mergeFloatingButtonConfig({ label: '   ' }).label,
    WHATSAPP_FLOATING_BUTTON_DEFAULTS.label,
  );
});

test('mergeFloatingButtonConfig recorta los textos largos', () => {
  assert.equal(mergeFloatingButtonConfig({ message: 'x'.repeat(500) }).message.length, 400);
  assert.equal(mergeFloatingButtonConfig({ label: 'y'.repeat(120) }).label.length, 80);
});

test('el botón no se muestra sin teléfono válido, aunque esté activado', () => {
  assert.equal(
    isFloatingButtonLive(mergeFloatingButtonConfig({ enabled: true, phone: '123' })),
    false,
  );
  assert.equal(
    isFloatingButtonLive(mergeFloatingButtonConfig({ enabled: false, phone: '5491155555555' })),
    false,
  );
  assert.equal(
    isFloatingButtonLive(mergeFloatingButtonConfig({ enabled: true, phone: '5491155555555' })),
    true,
  );
});
