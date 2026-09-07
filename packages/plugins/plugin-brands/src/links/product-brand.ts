import ProductModule from '@medusajs/medusa/product';
import { defineLink } from '@medusajs/framework/utils';
import BrandModule from '../modules/brand';

export default defineLink(
  {
    linkable: ProductModule.linkable.product,
    isList: true,
  },
  {
    linkable: BrandModule.linkable.brand,
    isList: false,
  },
  {
    database: {
      table: 'product_product_brand_brand',
      idPrefix: 'pbrnd',
    },
  }
);
