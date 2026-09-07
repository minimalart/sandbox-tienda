import { Badge, Button, Input, Label, StatusBadge, Table, Text, toast, usePrompt } from '@medusajs/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchJson } from '../../../lib/http';

/**
 * Pestaña "Documentación Fiscal" reutilizable por corporate y company.
 * Consume la API compartida /admin/fiscal-documents (owner polimórfico) para
 * consultar ARCA, generar la constancia, listar el historial, comparar
 * versiones y dar de baja lógica.
 */

const BASE_URL = '/admin/fiscal-documents';

type OwnerType = 'corporate' | 'company';

type DiffEntry = { field: string; label: string; before: string | null; after: string | null };

type FiscalDocument = {
  id: string;
  owner_type: OwnerType;
  owner_id: string;
  type: string;
  status: 'vigente' | 'historica';
  source: string;
  tax_id: string;
  file_id: string | null;
  file_url: string | null;
  snapshot: { legal_name?: string; tax_condition?: string };
  requested_by: string | null;
  generated_at: string | null;
  created_at: string;
};

/**
 * El `fetchJson` local se borró: ahora entra por `lib/http`, que inyecta `x-site-id`.
 *
 * Esta pestaña era la TERCERA copia literal del helper que el encabezado de
 * `site-transport.test.ts` nombra como el bug original. La card de Preferencias
 * (`store-config/components/fiscal-docs-card.tsx`) se migró; estas dos, un directorio
 * más abajo, no — y el ratchet no las veía porque miraba sólo `hooks/api` sin recursión.
 *
 * Sin el header, `assertFiscalOwnerInSite` hacía `return` en su primera línea y el
 * guard quedaba en no-op: sabiendo el `owner_id` de una empresa de otra tienda se leía
 * su constancia de AFIP, con CUIT, razón social y domicilio fiscal adentro.
 *
 * Con el header el guard empieza a disparar, y eso NO cambia lo que ve el operador: los
 * dos dueños posibles se cargan por `hooks/api/companies.tsx` y `hooks/api/corporates.tsx`,
 * que también usan `lib/http`, así que la fila sólo se abre si es de la tienda activa — y
 * si se abre, el owner pasa el guard. La única fila que ahora responde 404 es la que el
 * operador nunca pudo llegar a ver.
 *
 * Queda un agujero conocido y fuera de alcance acá: el botón "Ver / Descargar" es un
 * `<a href>`, o sea una navegación del browser, y una navegación no lleva headers
 * propios. Su ruta tiene guard igual, pero le llega sin tienda y no filtra. Cerrarlo
 * pide cambiar el link por una descarga con `siteHeaders()` y un blob, que es otro
 * cambio — se documenta acá para que no se lea como olvido.
 */

const TAX_CONDITION_LABELS: Record<string, string> = {
  responsable_inscripto: 'Responsable Inscripto',
  exento: 'Exento',
  monotributo: 'Monotributo',
  consumidor_final: 'Consumidor Final',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function FiscalDocsTab({
  ownerType,
  ownerId,
  defaultCuit,
}: {
  ownerType: OwnerType;
  ownerId: string;
  defaultCuit?: string | null;
}) {
  const qc = useQueryClient();
  const queryKey = ['fiscal-documents', ownerType, ownerId] as const;
  const prompt = usePrompt();
  const [cuit, setCuit] = useState((defaultCuit ?? '').replace(/\D/g, ''));
  const [changes, setChanges] = useState<{ changes: DiffEntry[]; context: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      fetchJson<{ fiscal_documents: FiscalDocument[] }>(
        `${BASE_URL}?owner_type=${ownerType}&owner_id=${encodeURIComponent(ownerId)}`,
      ),
    enabled: !!ownerId,
  });

  const generate = useMutation({
    mutationFn: () =>
      fetchJson<{ fiscal_document: FiscalDocument; diff: DiffEntry[]; changed: boolean }>(BASE_URL, {
        method: 'POST',
        body: JSON.stringify({ owner_type: ownerType, owner_id: ownerId, cuit }),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey });
      if (res.changed && res.diff.length) {
        setChanges({ changes: res.diff, context: 'Se detectaron cambios respecto de la última consulta.' });
        toast.warning('Constancia generada — se detectaron cambios fiscales.');
      } else {
        setChanges(null);
        toast.success('Constancia generada.');
      }
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => fetchJson(`${BASE_URL}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success('Documento dado de baja.');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const showDiff = async (id: string) => {
    try {
      const res = await fetchJson<{ changes: DiffEntry[]; changed: boolean }>(`${BASE_URL}/${id}/diff`);
      if (!res.changed) {
        toast.info('No hay diferencias con la versión anterior.');
        setChanges(null);
        return;
      }
      setChanges({ changes: res.changes, context: 'Diferencias respecto de la versión anterior.' });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const docs = data?.fiscal_documents ?? [];

  return (
    <div className="flex flex-col gap-3">
      {/* Consulta / generación */}
      <div className="flex flex-col gap-2 rounded-lg border border-ui-border-base p-3">
        <Text size="xsmall" weight="plus">
          Consultar ARCA
        </Text>
        <div className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <Label size="xsmall">CUIT</Label>
            <Input
              placeholder="Sin guiones"
              value={cuit}
              onChange={(e) => setCuit(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <Button
            size="small"
            onClick={() => generate.mutate()}
            isLoading={generate.isPending}
            disabled={cuit.length !== 11}
          >
            {docs.length ? 'Actualizar' : 'Consultar ARCA'}
          </Button>
        </div>
        <Text size="xsmall" className="text-ui-fg-subtle">
          Consulta la constancia en ARCA, genera el PDF y guarda una versión nueva (la anterior se
          archiva).
        </Text>
      </div>

      {/* Cambios detectados */}
      {changes ? (
        <div className="flex flex-col gap-2 rounded-lg border border-ui-tag-orange-border bg-ui-tag-orange-bg p-3">
          <Text size="small" weight="plus" className="text-ui-tag-orange-text">
            ⚠ {changes.context}
          </Text>
          <div className="flex flex-col gap-1">
            {changes.changes.map((c) => (
              <div key={c.field} className="text-ui-tag-orange-text text-xs">
                <span className="font-medium">{c.label}:</span> {c.before ?? '—'} → {c.after ?? '—'}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Historial */}
      {isLoading ? (
        <Text className="text-ui-fg-subtle">Cargando…</Text>
      ) : docs.length === 0 ? (
        <div className="rounded-lg border border-ui-border-base border-dashed p-6 text-center">
          <Text className="text-ui-fg-subtle">No existen constancias.</Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Documento</Table.HeaderCell>
              <Table.HeaderCell>Fecha</Table.HeaderCell>
              <Table.HeaderCell>Estado</Table.HeaderCell>
              <Table.HeaderCell> </Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {docs.map((d) => (
              <Table.Row key={d.id}>
                <Table.Cell>
                  <Text size="small">Constancia</Text>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {TAX_CONDITION_LABELS[d.snapshot?.tax_condition ?? ''] ?? d.snapshot?.tax_condition ?? ''}
                  </Text>
                </Table.Cell>
                <Table.Cell>{formatDate(d.generated_at ?? d.created_at)}</Table.Cell>
                <Table.Cell>
                  {d.status === 'vigente' ? (
                    <StatusBadge color="green">Vigente</StatusBadge>
                  ) : (
                    <Badge size="2xsmall" color="grey">
                      Histórica
                    </Badge>
                  )}
                </Table.Cell>
                <Table.Cell>
                  <div className="flex justify-end gap-2">
                    {d.file_id ? (
                      <a href={`${BASE_URL}/${d.id}/download`} target="_blank" rel="noreferrer">
                        <Button size="small" variant="secondary">
                          Ver / Descargar
                        </Button>
                      </a>
                    ) : (
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        Sin PDF
                      </Text>
                    )}
                    <Button size="small" variant="transparent" onClick={() => showDiff(d.id)}>
                      Comparar
                    </Button>
                    <Button
                      size="small"
                      variant="transparent"
                      className="text-ui-fg-error"
                      onClick={async () => {
                        const ok = await prompt({
                          title: 'Dar de baja',
                          description: '¿Dar de baja este documento? No se borra el historial, solo se oculta.',
                          confirmText: 'Dar de baja',
                          cancelText: 'Cancelar',
                        });
                        if (ok) remove.mutate(d.id);
                      }}
                    >
                      Eliminar
                    </Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </div>
  );
}
