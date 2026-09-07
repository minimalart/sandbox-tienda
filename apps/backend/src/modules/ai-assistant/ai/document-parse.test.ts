import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractDocumentText,
  isSupportedDocumentMime,
  sha256,
  UnsupportedDocumentError,
} from './document-parse.ts';

test('extractDocumentText: txt/md decodifica utf8 y trimea', async () => {
  const txt = await extractDocumentText(Buffer.from('  hola\nmundo  ', 'utf8'), 'text/plain');
  assert.equal(txt, 'hola\nmundo');
  const md = await extractDocumentText(Buffer.from('# Título\n\nCuerpo', 'utf8'), 'text/markdown');
  assert.equal(md, '# Título\n\nCuerpo');
});

test('extractDocumentText: mime no soportado tira', async () => {
  await assert.rejects(
    () => extractDocumentText(Buffer.from('x'), 'application/zip'),
    UnsupportedDocumentError,
  );
});

test('isSupportedDocumentMime', () => {
  assert.ok(isSupportedDocumentMime('application/pdf'));
  assert.ok(isSupportedDocumentMime('text/markdown'));
  assert.ok(!isSupportedDocumentMime('image/png'));
});

test('sha256: estable y sensible al contenido', () => {
  assert.equal(sha256('a'), sha256('a'));
  assert.notEqual(sha256('a'), sha256('b'));
  assert.match(sha256('a'), /^[0-9a-f]{64}$/);
});
