import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const { ContainerRegistrationKeys } = require('@medusajs/framework/utils');
const { QueryContext } = require('@medusajs/utils');

// Execute the plugin source with host dependencies, without starting Medusa or a DB.
function load(source: URL, dependencies: Record<string, unknown>) {
  const exports: Record<string, any> = {};
  const { outputText } = ts.transpileModule(readFileSync(source, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  runInNewContext(outputText, {
    exports,
    require: (id: string) => {
      assert.ok(id in dependencies, `Unexpected dependency: ${id}`);
      return dependencies[id];
    },
  });
  return exports;
}

const { STORE_CONFIG_MODULE } = load(new URL('../modules/store-config/index.ts', import.meta.url), {
  '@medusajs/framework/utils': { Module: () => ({}) },
  './service': {},
});
const { GET } = load(
  new URL(
    '../../../../packages/plugins/plugin-pdf-catalog/src/api/store/pdf-catalog/active/route.ts',
    import.meta.url
  ),
  {
    '@medusajs/framework/utils': { ContainerRegistrationKeys },
    '@medusajs/utils': { QueryContext },
    '../../../../modules/pdf-catalog': { PDF_CATALOG_MODULE: 'pdfCatalog' },
  }
);

async function request({
  enabled = true,
  installed = true,
  salesChannelId = 'channel-a',
  published = true,
  assigned = true,
} = {}) {
  let result: any;
  let catalogReads = 0;
  const services: Record<string, unknown> = {
    ...(installed
      ? {
          [STORE_CONFIG_MODULE]: {
            getBooleanSetting: async (key: string, fallback: boolean) => {
              assert.equal(key, 'pdf_catalog_enabled');
              assert.equal(fallback, false);
              return enabled;
            },
          },
        }
      : {}),
    pdfCatalog: {
      listPdfCatalogChannels: async (filter: unknown) => {
        catalogReads++;
        assert.deepEqual(filter && JSON.parse(JSON.stringify(filter)), {
          sales_channel_id: salesChannelId,
        });
        return assigned ? [{ catalog_id: `catalog-${salesChannelId}` }] : [];
      },
      retrievePdfCatalog: async (id: string) => ({
        id,
        name: 'Catalog',
        pdf_url: 'https://example.com/catalog.pdf',
        published,
        hotspots: [],
      }),
    },
    [ContainerRegistrationKeys.QUERY]: { graph: async () => ({ data: [] }) },
  };
  await GET(
    {
      query: { sales_channel_id: salesChannelId },
      scope: {
        resolve: (key: string) => {
          if (!(key in services)) throw new Error(`Unregistered: ${key}`);
          return services[key];
        },
      },
    },
    {
      json: (body: unknown) => {
        result = body;
      },
    }
  );
  return { result, catalogReads };
}

for (const salesChannelId of ['channel-a', 'channel-b']) {
  test(`returns the published catalog using the host registration for ${salesChannelId}`, async () => {
    const { result, catalogReads } = await request({ salesChannelId });
    assert.equal(result.catalog?.id, `catalog-${salesChannelId}`);
    assert.equal(result.catalog.pdf_url, 'https://example.com/catalog.pdf');
    assert.equal(catalogReads, 1);
  });
}

for (const options of [{ enabled: false }, { installed: false }, { salesChannelId: '' }]) {
  test(`does not query catalogs when unavailable: ${JSON.stringify(options)}`, async () => {
    const { result, catalogReads } = await request(options);
    assert.equal(result.catalog, null);
    assert.equal(catalogReads, 0);
  });
}

for (const options of [{ published: false }, { assigned: false }]) {
  test(`does not return an inactive catalog: ${JSON.stringify(options)}`, async () => {
    const { result } = await request(options);
    assert.equal(result.catalog, null);
  });
}
