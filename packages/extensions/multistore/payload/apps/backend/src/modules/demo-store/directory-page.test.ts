import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directoryPage } from './directory-page';
import {
  defaultDirectoryDocument,
  resolveDirectoryDocument,
  validateDirectoryDocument,
} from './directory-document';

test('directory loads every store in pages of 20, with no next page at the boundary', () => {
  for (const size of [0, 19, 20, 21, 45]) {
    const sites = Array.from({ length: size }, (_, index) => ({
      name: `Comunidad ${index}`,
      id: index,
    }));
    const first = directoryPage(sites, 0, '');
    assert.equal(first.sites.length, Math.min(20, size));
    assert.equal(first.next_offset, size > 20 ? 20 : null);
    const ids: number[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const page = directoryPage(sites, offset, '');
      ids.push(...page.sites.map((site) => site.id));
      offset = page.next_offset;
    }
    assert.deepEqual(
      ids,
      sites.map((site) => site.id)
    );
  }
});
test('search includes stores beyond the first page and ignores accents', () => {
  const sites = [
    ...Array.from({ length: 25 }, () => ({ name: 'Otra tienda' })),
    { name: 'Institución Córdoba' },
  ];
  assert.equal(directoryPage(sites, 0, 'cordoba').count, 1);
  assert.equal(directoryPage(sites, 0, 'no existe').count, 0);
});
test('Puck defaults, independent brand profiles, ordering and explicit empty fields', () => {
  assert.equal(validateDirectoryDocument(defaultDirectoryDocument), null);
  assert.equal(resolveDirectoryDocument(null).name, 'Tiendas');
  for (const name of ['Instituciones', 'Clubes', 'Distribuidores']) {
    const doc = structuredClone(defaultDirectoryDocument);
    doc.content[0].props.name = name;
    doc.content[1].props.description = '';
    doc.content.reverse();
    assert.equal(validateDirectoryDocument(doc), null);
    const config = resolveDirectoryDocument(doc);
    assert.equal(config.name, name);
    assert.equal(config.description, '');
    assert.equal((config.sections as string[])[0], 'DirectoryFooter');
  }
  assert.equal(resolveDirectoryDocument(defaultDirectoryDocument).name, 'Tiendas');
});
test('Puck rejects unsafe links, duplicates, missing listing and invalid content', () => {
  const doc = structuredClone(defaultDirectoryDocument);
  doc.content[0].props.cta_url = 'javascript:alert(1)';
  assert.ok(validateDirectoryDocument(doc));
  doc.content[0].props.cta_url = '/contacto';
  assert.equal(validateDirectoryDocument(doc), null);
  doc.content[0].props.cta_url = '//external.test';
  assert.ok(validateDirectoryDocument(doc));
  assert.ok(validateDirectoryDocument({ ...doc, content: [] }));
  assert.ok(validateDirectoryDocument({ ...doc, content: [doc.content[2], doc.content[2]] }));
});
