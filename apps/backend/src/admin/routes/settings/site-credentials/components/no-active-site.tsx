import { Button, Container, Label, Select, Text } from '@medusajs/ui';
import { useState } from 'react';
import type { AdminSiteCredentialsResponse } from '../../../../hooks/api/site-credentials';
import { useActiveSite } from '../../../../hooks/use-active-site';

export const NoActiveSiteView = ({ data }: { data: AdminSiteCredentialsResponse }) => {
  const { sites, setActiveSite } = useActiveSite();
  const [choice, setChoice] = useState('');
  return (
    <Container className="flex flex-col gap-3">
      <Text size="small">
        {data.scope === 'registryAbsent'
          ? 'Esta instalación usa cuentas compartidas. Las conexiones disponibles se administran desde su detalle.'
          : 'Elegí una tienda para administrar sus cuentas propias.'}
      </Text>
      {sites.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="site-credentials-picker">Tienda</Label>
          <Select size="small" value={choice} onValueChange={setChoice}>
            <Select.Trigger id="site-credentials-picker" className="min-w-[220px]">
              <Select.Value placeholder="Elegí una tienda" />
            </Select.Trigger>
            <Select.Content>
              {sites.map((site) => (
                <Select.Item key={site.id} value={site.id}>
                  {site.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Button
            size="small"
            disabled={!choice}
            onClick={() => {
              const site = sites.find((s) => s.id === choice);
              if (site)
                setActiveSite({ id: site.id, slug: site.slug, name: site.name }, { reload: false });
            }}
          >
            Seleccionar
          </Button>
        </div>
      )}
    </Container>
  );
};
