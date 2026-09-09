/** Conserva la configuración anterior al incluir el importador en Tiendas. */
export const catalogSettingsMigrationSql = `
DO $$ BEGIN
  IF to_regclass('site_setting') IS NOT NULL THEN
    INSERT INTO site_setting (id, site_id, namespace, value)
    SELECT 'sites_import_' || md5(id), NULL, 'extension:multistore',
      jsonb_build_object('DEMO_IMPORT_STALE_MS', value->'DEMO_IMPORT_STALE_MS')
    FROM site_setting
    WHERE namespace = 'extension:store-importer'
      AND site_id IS NULL AND deleted_at IS NULL
      AND value ? 'DEMO_IMPORT_STALE_MS'
    ON CONFLICT (namespace) WHERE site_id IS NULL AND deleted_at IS NULL
    DO UPDATE SET value = EXCLUDED.value || site_setting.value, updated_at = now();
  END IF;
END $$;`;
