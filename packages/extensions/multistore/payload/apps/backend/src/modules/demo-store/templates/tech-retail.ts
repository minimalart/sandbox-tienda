import type { DemoStoreLike, DemoTemplate } from './types';
import { buildBaseAssets } from './shared';

export const techRetailTemplate: DemoTemplate = {
  code: 'tech-retail',
  name: 'Tecnologia Retail',
  tenant_template: 'tech-retail',
  vertical: 'tech-retail',
  preview_image:
    'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=1200&q=80',
  buildAssets: (demo: DemoStoreLike) => ({
    ...buildBaseAssets(demo),
    techRetail: {},
  }),
};
