import { defineRouteConfig } from '@medusajs/admin-sdk';
import { BuildingStorefront, EllipsisHorizontal } from '@medusajs/icons';
import {
  Button,
  Container,
  Drawer,
  DropdownMenu,
  Heading,
  IconButton,
  Input,
  Label,
  Select,
  StatusBadge,
  Table,
  Text,
  toast,
  Toaster,
  usePrompt,
} from '@medusajs/ui';
import { useEffect, useState } from 'react';
import {
  type Corporate,
  type CorporateStatus,
  useCorporates,
  useCreateCorporate,
  useDeleteCorporate,
} from '../../hooks/api/corporates';
import { ExtensionVersion } from '../../components/common/extension-version';
import { SiteScopeBar } from '../../components/common/site-scope-bar';
import CorporateDetail from './components/corporate-detail';

const STATUS_COLORS: Record<CorporateStatus, 'green' | 'orange' | 'red' | 'grey'> = {
  active: 'green',
  pending: 'orange',
  suspended: 'red',
  archived: 'grey',
};

const STATUS_LABELS: Record<CorporateStatus, string> = {
  active: 'Activa',
  pending: 'Pendiente',
  suspended: 'Suspendida',
  archived: 'Archivada',
};

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const CreateDrawer = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const create = useCreateCorporate();
  const [form, setForm] = useState({ name: '', legal_name: '', tax_id: '', email_domain: '' });

  const submit = async () => {
    if (form.name.trim().length < 2) {
      toast.error('Ingresá el nombre de la empresa');
      return;
    }
    try {
      await create.mutateAsync({
        name: form.name.trim(),
        legal_name: form.legal_name || null,
        tax_id: form.tax_id || null,
        email_domain: form.email_domain || null,
      });
      toast.success('Empresa creada');
      setForm({ name: '', legal_name: '', tax_id: '', email_domain: '' });
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <Heading>Nueva empresa</Heading>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label size="xsmall">Nombre</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label size="xsmall">Razón social</Label>
            <Input
              value={form.legal_name}
              onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label size="xsmall">CUIT / Tax ID</Label>
            <Input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label size="xsmall">Dominio de email</Label>
            <Input
              placeholder="empresa.com"
              value={form.email_domain}
              onChange={(e) => setForm({ ...form, email_domain: e.target.value })}
            />
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} isLoading={create.isPending}>
            Crear
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

const CORPORATES_PAGE_SIZE = 20;

const CorporatesPage = () => {
  const [status, setStatus] = useState<string>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const { data, isLoading } = useCorporates({
    limit: CORPORATES_PAGE_SIZE,
    offset: page * CORPORATES_PAGE_SIZE,
    status: status === 'all' ? undefined : status,
    q: search || undefined,
  });

  // Debounce the search input so we don't refetch on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);
  // Reset a la primera página al cambiar el filtro de estado.
  useEffect(() => {
    setPage(0);
  }, [status]);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<Corporate | null>(null);
  const del = useDeleteCorporate();
  const prompt = usePrompt();

  const corporates = data?.corporates ?? [];
  const count = data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(count / CORPORATES_PAGE_SIZE));

  const onDelete = async (c: Corporate) => {
    const ok = await prompt({
      title: 'Eliminar empresa',
      description: `¿Eliminar "${c.name}"? Se borran sus miembros e invitaciones. Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await del.mutateAsync(c.id);
      toast.success('Empresa eliminada');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <>
      <Container className="p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-x-2">
            <Heading>Corporativos</Heading>
            <ExtensionVersion extension="corporate" />
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="search"
              placeholder="Buscar empresas"
              className="w-[220px]"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <Select value={status} onValueChange={setStatus}>
              <Select.Trigger className="w-[140px]">
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="all">Todas</Select.Item>
                <Select.Item value="active">Activas</Select.Item>
                <Select.Item value="pending">Pendientes</Select.Item>
                <Select.Item value="suspended">Suspendidas</Select.Item>
                <Select.Item value="archived">Archivadas</Select.Item>
              </Select.Content>
            </Select>
            <Button size="small" variant="secondary" onClick={() => setCreateOpen(true)}>
              Crear
            </Button>
          </div>
        </div>

        {/*
          `scoped` con la prueba a mano, y NO por analogía con B2B, que es la pantalla
          gemela y quedó `unscoped`: `admin/corporates` mete el filtro en el WHERE
          (`siteFilter(…, CORPORATE_SITE_SCOPE)`, `api/admin/corporates/route.ts:40`) y
          el POST estampa la tienda con `siteDefaults` (`:74`), con el comentario que
          explica por qué —la empresa nace en la tienda activa o el operador no vuelve a
          encontrarla donde la creó—. `[id]` corre `assertIdInSite`.

          Justo eso es lo que le falta a `companies`: mismo listado, misma tabla de
          miembros, pero su alta escribe el canal mayorista de la instancia. Dos
          pantallas parecidas con distinto estado de migración es la razón de que este
          registro sea por PANTALLA.
        */}
        <SiteScopeBar screen="corporates" />

        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Empresa</Table.HeaderCell>
              <Table.HeaderCell>Estado</Table.HeaderCell>
              <Table.HeaderCell>Miembros</Table.HeaderCell>
              <Table.HeaderCell>Creada</Table.HeaderCell>
              <Table.HeaderCell> </Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {isLoading ? (
              <Table.Row>
                <Table.Cell colSpan={5}>Cargando…</Table.Cell>
              </Table.Row>
            ) : corporates.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={5}>No hay empresas todavía.</Table.Cell>
              </Table.Row>
            ) : (
              corporates.map((c) => (
                <Table.Row
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => setDetail(c)}
                >
                  <Table.Cell>
                    <div className="flex flex-col">
                      <Text size="small" weight="plus">
                        {c.name}
                      </Text>
                      {c.tax_id ? (
                        <Text size="xsmall" className="text-ui-fg-subtle">
                          {c.tax_id}
                        </Text>
                      ) : null}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge color={STATUS_COLORS[c.status]}>{STATUS_LABELS[c.status] ?? c.status}</StatusBadge>
                  </Table.Cell>
                  <Table.Cell>{c.members_count ?? '—'}</Table.Cell>
                  <Table.Cell>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {fmtDate(c.created_at)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenu.Trigger asChild>
                          <IconButton variant="transparent"><EllipsisHorizontal /></IconButton>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content>
                          <DropdownMenu.Item onClick={() => setDetail(c)}>Ver</DropdownMenu.Item>
                          <DropdownMenu.Item onClick={() => setDetail(c)}>Editar</DropdownMenu.Item>
                          <DropdownMenu.Separator />
                          <DropdownMenu.Item className="text-ui-fg-error" onClick={() => onDelete(c)}>
                            Eliminar
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>
        {count > 0 && (
          <div className="flex items-center justify-between px-6 py-4">
            <Text size="small" className="text-ui-fg-subtle">
              {count} {count === 1 ? 'resultado' : 'resultados'} · Página {page + 1} de {pages}
            </Text>
            <div className="flex gap-2">
              <Button
                size="small"
                variant="secondary"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Anterior
              </Button>
              <Button
                size="small"
                variant="secondary"
                disabled={page >= pages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </Container>

      <CreateDrawer open={createOpen} onClose={() => setCreateOpen(false)} />
      <CorporateDetail corporate={detail} onClose={() => setDetail(null)} />
      <Toaster />
    </>
  );
};

const CorporatesIcon = () => <BuildingStorefront style={{ color: '#0F766E' }} />;

export const config = defineRouteConfig({
  label: 'Corporativos',
  icon: CorporatesIcon,
  rank: 95,
});

// Breadcrumb in the top header (next to the notification bell), matching
// Medusa's built-in pages.
export const handle = {
  breadcrumb: () => 'Corporativos',
};

export default CorporatesPage;
