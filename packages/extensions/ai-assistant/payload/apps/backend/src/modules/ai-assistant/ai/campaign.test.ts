import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCampaignOutputsPatch, stepOut, strList } from './campaign.ts';

test('buildCampaignOutputsPatch mapea todos los outputs cuando cada paso devolvió su id', () => {
  const state = {
    resolver_productos: { product_ids: ['prod_1', 'prod_2'], notes: 'ok' },
    preparar_promocion: { promotion_id: 'promo_1', type: 'percentage', status: 'inactive' },
    crear_nota: { post_id: 'post_1', slug: 'semana-dulzura', preview_url: 'https://x/blog/semana-dulzura?preview=1' },
    crear_banner: { banner_id: 'ban_1' },
    crear_landing: { landing_id: 'land_1', slug: 'semana-dulzura' },
    validar: { is_ready: true, warnings: ['ojo con el stock'], missing_fields: [] },
  };
  const patch = buildCampaignOutputsPatch(state) as any;

  assert.deepEqual(patch.outputs.promotion, { promotion_id: 'promo_1', type: 'percentage', status: 'inactive' });
  assert.deepEqual(patch.outputs.blog_post, {
    post_id: 'post_1',
    slug: 'semana-dulzura',
    preview_url: 'https://x/blog/semana-dulzura?preview=1',
  });
  assert.deepEqual(patch.outputs.banner, { banner_id: 'ban_1' });
  assert.deepEqual(patch.outputs.landing, { landing_id: 'land_1', slug: 'semana-dulzura' });
  // Los product_ids resueltos por la IA se vuelcan a la selección (para el preview y las acciones).
  assert.deepEqual(patch.product_selection, { product_ids: ['prod_1', 'prod_2'] });
  assert.deepEqual(patch.validation, { warnings: ['ojo con el stock'] });
});

test('buildCampaignOutputsPatch omite el output de un paso de contenido que no devolvió id', () => {
  // Caso real: un subagente headless no puede ejecutar una tool `ask` (crear banner) y
  // vuelve solo con texto, sin banner_id. Ese output NO debe aparecer (el botón del
  // preview quedaría apuntando a nada); el resto sí.
  const state = {
    resolver_productos: { product_ids: ['prod_1'] },
    crear_nota: { post_id: 'post_1', slug: 's', preview_url: 'u' },
    crear_banner: { text: 'No pude crear el banner.' },
    validar: { is_ready: false, warnings: [] },
  };
  const patch = buildCampaignOutputsPatch(state) as any;

  assert.ok(patch.outputs.blog_post, 'la nota sí se mapea');
  assert.equal(patch.outputs.banner, undefined, 'el banner sin id no se mapea');
  assert.equal(patch.outputs.landing, undefined);
  assert.equal(patch.outputs.promotion, undefined);
  assert.deepEqual(patch.product_selection, { product_ids: ['prod_1'] });
  // Sin warnings → no se agrega la clave validation (upsertCampaign la recomputa igual).
  assert.equal('validation' in patch, false);
});

test('buildCampaignOutputsPatch con estado vacío devuelve outputs vacíos y sin claves de más', () => {
  const patch = buildCampaignOutputsPatch({}) as any;
  assert.deepEqual(patch.outputs, {});
  assert.equal('product_selection' in patch, false);
  assert.equal('validation' in patch, false);
});

test('stepOut / strList son defensivos ante formas inesperadas', () => {
  assert.deepEqual(stepOut({ a: 42 }, 'a'), {}, 'un escalar no es un sub-objeto de paso');
  assert.deepEqual(stepOut({ a: ['x'] }, 'a'), {}, 'un array tampoco');
  assert.deepEqual(stepOut({ a: { k: 1 } }, 'a'), { k: 1 });
  assert.deepEqual(stepOut({}, 'nope'), {});

  assert.deepEqual(strList(['a', 1, 'b', null, 'c']), ['a', 'b', 'c']);
  assert.deepEqual(strList('no-array'), []);
  assert.deepEqual(strList(undefined), []);
});
