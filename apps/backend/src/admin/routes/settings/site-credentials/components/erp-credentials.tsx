import { Badge, Button, Input, Text, toast } from '@medusajs/ui';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sdk } from '../../../../lib/client';

type ErpStatus = {
  config: { provider: string; credential_keys: string[]; credentials_set: boolean } | null;
};
export const useErpCredentialStatus = (enabled: boolean) =>
  useQuery({
    queryKey: ['integration-erp-credentials'],
    enabled,
    queryFn: () => sdk.client.fetch<ErpStatus>('/admin/erp/config'),
  });

export const ErpCredentials = () => {
  const { data, isPending, error } = useErpCredentialStatus(true);
  const [rows, setRows] = useState<{ key: string; value: string }[]>([]);
  const [remove, setRemove] = useState<string[]>([]);
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch('/admin/erp/config', {
        method: 'POST',
        body: {
          credentials: Object.fromEntries(
            rows.filter((r) => r.key.trim() && r.value.trim()).map((r) => [r.key.trim(), r.value])
          ),
          credentials_remove: remove,
        },
      }),
    onSuccess: () => {
      setRows([]);
      setRemove([]);
      void client.invalidateQueries({ queryKey: ['integration-erp-credentials'] });
      void client.invalidateQueries({ queryKey: ['erp'] });
      toast.success('Credenciales guardadas');
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (isPending) return <Text>Cargando credenciales…</Text>;
  if (error) return <Text role="alert">No se pudieron cargar las credenciales del ERP.</Text>;
  return (
    <div className="flex flex-col gap-4">
      <Text size="small">
        Proveedor: {data?.config?.provider ?? 'Sin seleccionar'}. Esta cuenta se comparte entre las
        tiendas que usan el ERP.
      </Text>
      {(data?.config?.credential_keys ?? []).map((key) => (
        <div key={key} className="flex items-center justify-between gap-2">
          <Badge>{key}</Badge>
          <Button
            size="small"
            variant="secondary"
            disabled={save.isPending}
            onClick={() =>
              setRemove((prev) =>
                prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
              )
            }
          >
            {remove.includes(key) ? 'Deshacer' : 'Eliminar'}
          </Button>
        </div>
      ))}
      {rows.map((row, index) => (
        <div key={index} className="flex gap-2">
          <Input
            aria-label={`Nombre de credencial ${index + 1}`}
            placeholder="Nombre de clave"
            value={row.key}
            disabled={save.isPending}
            onChange={(e) =>
              setRows((prev) =>
                prev.map((r, i) => (i === index ? { ...r, key: e.target.value } : r))
              )
            }
          />
          <Input
            aria-label={`Valor de credencial ${index + 1}`}
            type="password"
            placeholder="Valor"
            autoComplete="new-password"
            value={row.value}
            disabled={save.isPending}
            onChange={(e) =>
              setRows((prev) =>
                prev.map((r, i) => (i === index ? { ...r, value: e.target.value } : r))
              )
            }
          />
          <Button
            aria-label={`Quitar credencial ${index + 1}`}
            variant="transparent"
            disabled={save.isPending}
            onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
          >
            ×
          </Button>
        </div>
      ))}
      <Button
        variant="secondary"
        size="small"
        disabled={save.isPending}
        onClick={() => setRows((prev) => [...prev, { key: '', value: '' }])}
      >
        Agregar o reemplazar credencial
      </Button>
      <Button
        disabled={
          (!rows.some((r) => r.key.trim() && r.value.trim()) && !remove.length) ||
          rows.some((r) => !r.key.trim() || !r.value.trim()) ||
          new Set(rows.map((r) => r.key.trim())).size !== rows.length
        }
        isLoading={save.isPending}
        onClick={() => save.mutate()}
      >
        Guardar credenciales
      </Button>
    </div>
  );
};
