import assert from 'node:assert/strict';
import { findBarcodeVariant } from './match.ts';

const product = {
  id: 'prod_1',
  title: 'Yerba Mate',
  handle: 'yerba-mate',
  thumbnail: 'https://example.com/yerba.jpg',
  variants: [
    {
      id: 'variant_1',
      title: '1kg',
      sku: '7791234567890',
      barcode: null,
      ean: null,
      upc: null,
      metadata: { ean: ' 779-1234567890 ' },
    },
  ],
};

const match = findBarcodeVariant('779 1234567890', [product]);

assert.deepEqual(match, {
  product_id: 'prod_1',
  product_title: 'Yerba Mate',
  product_handle: 'yerba-mate',
  product_thumbnail: 'https://example.com/yerba.jpg',
  variant_id: 'variant_1',
  variant_title: '1kg',
  sku: '7791234567890',
  barcode: '7791234567890',
});
