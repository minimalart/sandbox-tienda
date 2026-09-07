import type { DemoStoreLike, DemoTemplate } from './types';
import { buildBaseAssets } from './shared';

export const fashionTemplate: DemoTemplate = {
  code: 'fashion',
  name: 'Fashion',
  tenant_template: 'fashion',
  vertical: 'fashion',
  preview_image:
    'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80',
  buildAssets: (demo: DemoStoreLike) => ({
    ...buildBaseAssets(demo),
    fashion: {},
  }),
};
