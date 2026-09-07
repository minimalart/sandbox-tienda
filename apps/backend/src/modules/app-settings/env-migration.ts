import type { AppSettingState } from './resolve';
import type { SettingDescriptor } from './descriptors/types';
import { buildWritePlan } from './write-plan';

/** Only explicit, present env values are copied; defaults and existing DB
 * settings are never materialized or overwritten. No values enter the report. */
export function planEnvMigration(
  descriptors: SettingDescriptor[],
  states: AppSettingState[],
  env: Record<string, string | undefined>
) {
  const values: Record<string, unknown> = {};
  const keys: string[] = [];
  for (const descriptor of descriptors) {
    const state = states.find(
      (s) => s.namespace === descriptor.namespace && s.key === descriptor.key
    );
    if (!state || state.is_set) continue;
    const alias = descriptor.env.find((name) => env[name]?.trim());
    if (!alias) continue;
    keys.push(descriptor.key);
    values[descriptor.key] = descriptor.type === 'secret' ? env[alias] : env[alias]!.trim();
  }
  return { keys, plan: buildWritePlan({ descriptors, values }) };
}
