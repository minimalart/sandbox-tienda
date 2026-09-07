import assert from 'node:assert/strict';
import test from 'node:test';
import { createEducabotConfigurator, type EducabotCatalog } from './educabot';
import { ConfiguratorSchema, selectionQuantities } from '../src/validation';

test('all three example templates publish preassembled and contain catalog-bound technology', () => {
  const slots = [
    'workstation',
    'teacher_desk',
    'storage',
    'computer',
    'projector',
    'robotics_kit',
  ] as const;
  const catalog = Object.fromEntries(
    slots.map((slot) => [
      slot,
      {
        product_id: `product_${slot}`,
        variant_id: `variant_${slot}`,
      },
    ])
  ) as EducabotCatalog;
  const input = createEducabotConfigurator('sales_channel_educabot', catalog);
  assert.equal(input.status, 'draft');
  assert.deepEqual(
    input.config.products.map((product) => product.label),
    [
      'Estación colaborativa hexagonal',
      'Escritorio docente',
      'Mueble de guardado',
      'Computadora educativa',
      'Proyector para aula',
      'Kit de robótica',
    ]
  );
  const published = ConfiguratorSchema.parse({ ...input, status: 'published' });
  assert.equal(published.config.templates.length, 3);
  published.config.templates.forEach((template, index) => {
    assert.equal(template.objects.length, index + 4);
    const quantities = selectionQuantities(published.config, { version: 1, ...template });
    assert.equal(quantities.get('variant_workstation'), index + 2);
    assert.equal(quantities.get('variant_computer'), (index + 2) * 2);
    assert.equal(quantities.get('variant_projector'), 1);
    assert.equal(quantities.get('variant_robotics_kit'), (index + 2) * 2);
  });
  assert.equal(
    input.config.products.some((product) => 'price' in product),
    false
  );
  assert.deepEqual(
    input.config.products.map((product) => product.asset?.model),
    ['hex-table-set', 'desk', 'shelving', 'computer', 'projector', 'robotics-kit']
  );
  for (const ref of ['computer', 'robotics_kit']) {
    const equipment = input.config.products.find((product) => product.id === ref)!;
    assert.equal(equipment.placement, 'included');
    assert.equal(equipment.asset?.mount, 'surface');
    assert.equal(equipment.asset?.anchor_product_ref, 'workstation');
    assert.ok(equipment.dimensions!.width <= 0.35);
  }
  assert.equal(
    input.config.products.find((product) => product.id === 'projector')?.asset?.mount,
    'ceiling'
  );
  assert.equal(
    input.config.products.find((product) => product.id === 'teacher_desk')?.asset?.kind,
    'glb'
  );
  assert.equal(
    input.config.products.find((product) => product.id === 'teacher_desk')?.asset?.url,
    '/space-designer/examples/models/teacher-desk.glb'
  );
  assert.equal(
    published.config.templates[0]!.room.floor_texture_url,
    '/space-designer/examples/floors/piso-vinilico.png'
  );
  assert.equal(published.config.surface_options?.walls?.length, 3);
});
