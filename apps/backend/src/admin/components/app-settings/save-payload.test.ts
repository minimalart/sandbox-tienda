import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSavePayload, isBlankDraft } from './save-payload';
import type { SettingType } from '../../../modules/app-settings/descriptors/types';

const types: Record<string, SettingType> = {
  ADMIN_EMAIL: 'string',
  EMAIL_ICONS_BASE_URL: 'url',
  SENDGRID_API_KEY: 'secret',
  ENABLED: 'boolean',
  RETRIES: 'number',
};

const build = (draft: Record<string, unknown>, unset: string[] = [], set: string[] = []) =>
  buildSavePayload({
    typeOf: (key) => types[key],
    isSet: (key) => set.includes(key),
    draft,
    unset,
  });

test('el bug del Jam: un campo opcional vaciado NO bloquea el guardado del resto', () => {
  // Sendgrid → Configuración: se toca la base de iconos, se la deja en blanco y se
  // edita el mail de avisos. Antes viajaba `EMAIL_ICONS_BASE_URL: ''` y el backend
  // rechazaba la card entera.
  const payload = build({ ADMIN_EMAIL: 'ventas@tienda.com', EMAIL_ICONS_BASE_URL: '' });
  assert.deepEqual(payload, { values: { ADMIN_EMAIL: 'ventas@tienda.com' }, unset: [] });
});

test('vaciar un campo CON override guardado es un Restaurar: va a unset', () => {
  const payload = build({ EMAIL_ICONS_BASE_URL: '   ' }, [], ['EMAIL_ICONS_BASE_URL']);
  assert.deepEqual(payload, { values: {}, unset: ['EMAIL_ICONS_BASE_URL'] });
});

test('un secreto en blanco no viaja ni se borra, tenga o no valor guardado', () => {
  assert.deepEqual(build({ SENDGRID_API_KEY: '' }), { values: {}, unset: [] });
  assert.deepEqual(build({ SENDGRID_API_KEY: '' }, [], ['SENDGRID_API_KEY']), {
    values: {},
    unset: [],
  });
});

test('tipear después de Restaurar gana sobre el borrado encolado', () => {
  const payload = build({ ADMIN_EMAIL: 'nuevo@tienda.com' }, ['ADMIN_EMAIL'], ['ADMIN_EMAIL']);
  assert.deepEqual(payload, { values: { ADMIN_EMAIL: 'nuevo@tienda.com' }, unset: [] });
});

test('los unset ajenos al borrador se conservan y no se duplican', () => {
  const payload = build({ ADMIN_EMAIL: '' }, ['RETRIES', 'ADMIN_EMAIL'], ['ADMIN_EMAIL']);
  assert.deepEqual(payload, { values: {}, unset: ['RETRIES', 'ADMIN_EMAIL'] });
});

test('los valores no vacíos viajan tal cual, sin trim: eso lo hace el backend', () => {
  const payload = build({ ADMIN_EMAIL: ' a@b.co ', RETRIES: '3', ENABLED: false });
  assert.deepEqual(payload, {
    values: { ADMIN_EMAIL: ' a@b.co ', RETRIES: '3', ENABLED: false },
    unset: [],
  });
});

test('isBlankDraft: los booleanos nunca están en blanco; null y espacios sí', () => {
  assert.equal(isBlankDraft('boolean', false), false);
  assert.equal(isBlankDraft('boolean', undefined), false);
  assert.equal(isBlankDraft('string', null), true);
  assert.equal(isBlankDraft('url', '  '), true);
  assert.equal(isBlankDraft('number', ''), true);
  assert.equal(isBlankDraft('number', 0), false);
  assert.equal(isBlankDraft(undefined, ''), true);
  assert.equal(isBlankDraft(undefined, 'x'), false);
});
