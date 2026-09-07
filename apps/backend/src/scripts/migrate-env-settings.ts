import type { ExecArgs, Logger } from '@medusajs/framework/types';
import { settingsNamespaces } from '../modules/app-settings/descriptors';
import { applyPlan, getStates } from '../modules/app-settings/service';
import { planEnvMigration } from '../modules/app-settings/env-migration';

/** Run inside the backend's actual deployment environment. Default: read only.
 * Copies the legacy env layer to the same instance layer, not to every store. */
export default async function migrateEnvSettings({ container, args }: ExecArgs) {
  const apply = args.includes('--apply');
  const requested = args.filter((arg) => arg !== '--apply');
  if (requested.some((name) => !settingsNamespaces.some((ns) => ns.namespace === name))) {
    throw new Error('Unknown namespace. Use extension:typesense, for example.');
  }
  if (process.env.APP_SETTINGS_DISABLE === 'true') {
    throw new Error('APP_SETTINGS_DISABLE is enabled; database settings are bypassed.');
  }
  const logger = container.resolve<Logger>('logger');
  const selected = settingsNamespaces.filter(
    (ns) => !requested.length || requested.includes(ns.namespace)
  );
  const prepared = [];
  let invalid = false;
  for (const ns of selected) {
    const states = await getStates(container, ns.settings);
    const { keys, plan } = planEnvMigration(ns.settings, states, process.env);
    if (!plan.ok) {
      invalid = true;
      // Validation errors can contain user-supplied text: log names only.
      logger.warn(`${ns.namespace}: revisar ${Object.keys(plan.errors).join(', ')}`);
      continue;
    }
    if (!plan.writes.length) continue;
    logger.info(`${apply ? 'Preparado' : 'Migrable'} ${ns.namespace}: ${keys.join(', ')}`);
    prepared.push({ ns, plan });
  }
  if (invalid) throw new Error('Hay valores inválidos. No se guardó ningún ajuste.');
  if (!apply) {
    logger.info(
      'Simulación: no se escribió ni se eliminó ninguna variable. Agregá --apply para guardar.'
    );
    return;
  }
  for (const { ns } of prepared) {
    // Recheck before writing so an override saved during planning is preserved.
    const states = await getStates(container, ns.settings);
    const { plan } = planEnvMigration(ns.settings, states, process.env);
    if (!plan.ok) throw new Error(`Validación fallida: ${ns.namespace}`);
    await applyPlan(container, {
      namespace: ns.namespace,
      descriptors: ns.settings,
      plan,
      actorId: null,
      onlyMissing: true,
    });
    const verified = await getStates(container, ns.settings);
    if (
      plan.writes.some(
        (w) =>
          !verified.some((s) => s.key === w.key && s.source === 'global' && s.decryptable !== false)
      )
    ) {
      throw new Error(`No se pudo verificar lo guardado: ${ns.namespace}. Conservá las variables.`);
    }
    logger.info(`Guardado y verificado: ${ns.namespace}`);
  }
  logger.info(
    'Migración terminada. Conservá las variables de build, infraestructura y consumidores externos indicadas en docs/recipes/limpiar-el-env.md.'
  );
}
