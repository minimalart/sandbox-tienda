import type { DemoStoreLike, DemoTemplate } from './types';
import { buildBaseAssets } from './shared';

export const sportsTemplate: DemoTemplate = {
  code: 'sports',
  name: 'Marca Deportiva',
  tenant_template: 'sports',
  vertical: 'sports',
  preview_image:
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80',
  buildAssets: (demo: DemoStoreLike) => ({
    ...buildBaseAssets(demo),
    sports: {},
  }),
};
