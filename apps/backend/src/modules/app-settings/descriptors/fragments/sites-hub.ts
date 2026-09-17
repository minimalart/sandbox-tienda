import type { SettingDescriptor } from '../types';
import {
  defaultDirectoryDocument,
  validateDirectoryDocument,
} from '../../../demo-store/directory-document';

export const sitesHubSettings: Omit<SettingDescriptor, 'namespace' | 'scope'>[] = [
  {
    key: 'SITES_HUB_PUCK',
    env: [],
    type: 'json',
    tier: 'runtime',
    group: 'Home del directorio',
    label: 'Documento del directorio',
    help: 'Editar desde Tiendas → Editar directorio (Puck). Independiente de la home principal.',
    default: defaultDirectoryDocument,
    refine: validateDirectoryDocument,
  },
];
