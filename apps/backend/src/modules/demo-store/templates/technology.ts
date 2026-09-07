import type { DemoStoreLike, DemoTemplate } from './types';
import { buildBaseAssets } from './shared';

export const technologyTemplate: DemoTemplate = {
  code: 'technology',
  name: 'Tecnologia',
  tenant_template: 'technology',
  vertical: 'technology',
  preview_image:
    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80',
  buildAssets: (demo: DemoStoreLike) => ({
    ...buildBaseAssets(demo),
    technology: {},
  }),
};
