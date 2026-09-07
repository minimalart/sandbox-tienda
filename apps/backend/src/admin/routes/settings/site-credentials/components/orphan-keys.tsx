import { Badge, Button, Text } from '@medusajs/ui';
import type { SiteCredentialIntegration } from '../../../../hooks/api/site-credentials';

/**
 * Claves guardadas que el catálogo ya no declara: quedaron de un INSERT a mano o de
 * un rename del provider. No se pueden reemplazar (no hay campo donde escribirlas y
 * el POST rechaza claves desconocidas en `set`) pero SÍ borrar, que es lo único que
 * corresponde hacer con una clave que ningún lector busca.
 */
export const OrphanKeys = ({
  integration,
  unset,
  disabled,
  onToggleDelete,
}: {
  integration: SiteCredentialIntegration;
  unset: string[];
  disabled: boolean;
  onToggleDelete: (key: string) => void;
}) => {
  const declared = new Set(integration.keys.map((spec) => spec.key));
  const orphans = integration.set_keys.filter((key) => !declared.has(key));
  if (orphans.length === 0) return null;

  return (
    <div className="flex flex-col gap-y-2 rounded-md border border-ui-tag-orange-border bg-ui-tag-orange-bg px-3 py-2">
      <Text size="xsmall" className="text-ui-tag-orange-text">
        Estas claves están guardadas pero {integration.label} ya no las lee. Alguien las cargó a
        mano, o el provider las renombró. No hacen nada: conviene sacarlas.
      </Text>
      {orphans.map((key) => {
        const marked = unset.includes(key);
        return (
          <div key={key} className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge size="2xsmall" color={marked ? 'red' : 'grey'} className="font-mono">
              {key}
            </Badge>
            <Text size="xsmall" className="text-ui-fg-muted">
              {marked ? 'Se borrará al guardar' : 'Guardada, sin lector'}
            </Text>
            <Button variant="transparent" size="small" disabled={disabled} onClick={() => onToggleDelete(key)}>
              {marked ? 'Deshacer' : 'Borrar'}
            </Button>
          </div>
        );
      })}
    </div>
  );
};
