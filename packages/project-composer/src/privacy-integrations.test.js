const test = require('node:test');
const assert = require('node:assert/strict');
const { renderPrivacySlot } = require('./privacy-integrations');
const { catalog, resolveProjectSelection } = require('../../project-catalog/src');
test('templates do not force optional analytics into a minimal project', () => {
  for (const template of catalog.templates) {
    if (template.status !== 'ready') continue;
    const ids = resolveProjectSelection({ template: template.id }).extensions.map(e => e.id);
    assert.equal(ids.includes('ga4'), false, template.id);
    assert.equal(ids.includes('consent-management'), false, template.id);
  }
});
for (const ids of [
  [],
  ['newsletter'],
  ['consent-management'],
  ['ga4'],
  ['consent-management', 'ga4'],
  ['newsletter', 'consent-management', 'ga4'],
  ['clarity'],
  ['google-merchant'],
  ['clarity', 'google-merchant', 'consent-management', 'ga4'],
]) {
  test(`privacy seam composes independently: ${ids.join(',') || 'minimal'}`, () => {
    const source = renderPrivacySlot(ids);
    assert.equal(source.includes("from './consent/provider'"), ids.includes('consent-management'));
    assert.equal(source.includes("from './analytics/google-analytics'"), ids.includes('ga4'));
    assert.equal(source.includes("from './analytics/clarity'"), ids.includes('clarity'));
    assert.equal(source.includes("from './newsletter"), false);
  });
}
