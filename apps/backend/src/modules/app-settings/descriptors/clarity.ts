import { defineSettings } from './types';

export type ClarityConfig = { enabled: boolean; projectId: string; consentCategory: 'analytics' };
export function validateClarity(value: unknown): string | null {
  const v = value as ClarityConfig;
  return v &&
    typeof v.enabled === 'boolean' &&
    typeof v.projectId === 'string' &&
    ((!v.enabled && v.projectId === '') || /^[a-zA-Z0-9]{3,32}$/.test(v.projectId)) &&
    v.consentCategory === 'analytics'
    ? null
    : 'Invalid Clarity configuration';
}
export default defineSettings({
  namespace: 'extension:clarity',
  title: 'Microsoft Clarity',
  defaultScope: 'site',
  settings: [
    {
      key: 'CONFIG',
      env: [],
      type: 'json',
      tier: 'runtime',
      group: 'Clarity',
      label: 'Clarity',
      refine: validateClarity,
    },
    {
      key: 'EXPORT_TOKEN',
      env: [],
      type: 'secret',
      tier: 'runtime',
      group: 'Clarity',
      label: 'Data Export API token',
      help: 'Token privado del proyecto. Sólo se usa en el backend.',
    },
  ],
});
