import { defineRouteConfig } from '@medusajs/admin-sdk';
import { ChatBubbleLeftRightSolid, EllipsisHorizontal } from '@medusajs/icons';
import {
  Badge,
  Button,
  Checkbox,
  Container,
  Drawer,
  DropdownMenu,
  Heading,
  IconButton,
  StatusBadge,
  Table,
  Text,
  Toaster,
  toast,
} from '@medusajs/ui';
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  type ContactStatus,
  type ContactSubmission,
  useBulkUpdateContactStatus,
  useContactSubmissions,
  useUpdateContactStatus,
} from '../../hooks/api/contact-submissions';
import { SiteScopeBar } from '../../components/common/site-scope-bar';
// The version badge reads from the plugin's own package.json at build time.
// Vite inlines the value so there is no runtime JSON fetch and no hardcoded
// string to keep in sync with the release.
import pkg from '../../../../package.json';

const PLUGIN_VERSION = pkg.version;

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<ContactStatus, string> = {
  new: 'No leído',
  read: 'Leído',
  archived: 'Archivado',
};
const STATUS_COLOR: Record<ContactStatus, 'green' | 'grey' | 'orange'> = {
  new: 'green',
  read: 'grey',
  archived: 'orange',
};

const fmtDateTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' }) : '-';

const ContactDetail = ({
  contact,
  onClose,
  onStatus,
}: {
  contact: ContactSubmission | null;
  onClose: () => void;
  onStatus: (id: string, status: ContactStatus) => void;
}) => {
  return (
    <Drawer open={!!contact} onOpenChange={(v) => !v && onClose()}>
      <Drawer.Content className="z-50">
        <Drawer.Header>
          <div className="flex items-center gap-2">
            <Heading>
              {contact?.first_name} {contact?.last_name}
            </Heading>
            {contact ? (
              <StatusBadge color={STATUS_COLOR[contact.status]}>
                {STATUS_LABEL[contact.status]}
              </StatusBadge>
            ) : null}
          </div>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-4 overflow-y-auto">
          {contact ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Email">
                  <a className="text-ui-fg-interactive" href={`mailto:${contact.email}`}>
                    {contact.email}
                  </a>
                </Field>
                <Field label="Teléfono">
                  <Text size="small">{contact.phone || '-'}</Text>
                </Field>
                <Field label="Fecha">
                  <Text size="small">{fmtDateTime(contact.created_at)}</Text>
                </Field>
                <Field label="Origen">
                  <Text size="small">{contact.source || '-'}</Text>
                </Field>
              </div>
              <div className="flex flex-col gap-1">
                <Text size="xsmall" weight="plus" className="text-ui-fg-subtle">
                  Mensaje
                </Text>
                <div className="whitespace-pre-wrap rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3 text-ui-fg-base text-sm">
                  {contact.message}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 border-ui-border-base border-t pt-3">
                {contact.status !== 'read' ? (
                  <Button size="small" variant="secondary" onClick={() => onStatus(contact.id, 'read')}>
                    Marcar como leído
                  </Button>
                ) : (
                  <Button size="small" variant="secondary" onClick={() => onStatus(contact.id, 'new')}>
                    Marcar como no leído
                  </Button>
                )}
                <Button size="small" variant="secondary" onClick={() => onStatus(contact.id, 'archived')}>
                  Archivar
                </Button>
              </div>
            </>
          ) : null}
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  );
};

const ContactPage = () => {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<ContactSubmission | null>(null);
  const { data, isLoading } = useContactSubmissions({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });
  const updateStatus = useUpdateContactStatus();
  const bulkStatus = useBulkUpdateContactStatus();

  const items = data?.contact_submissions ?? [];
  const count = data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const allOnPageSelected = items.length > 0 && items.every((c) => selected.includes(c.id));
  const someOnPageSelected = items.some((c) => selected.includes(c.id));

  const toggleAll = () => {
    if (allOnPageSelected) {
      setSelected((prev) => prev.filter((id) => !items.some((c) => c.id === id)));
    } else {
      setSelected((prev) => Array.from(new Set([...prev, ...items.map((c) => c.id)])));
    }
  };
  const toggleOne = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const setStatus = async (id: string, status: ContactStatus) => {
    try {
      await updateStatus.mutateAsync({ id, status });
      setDetail((d) => (d && d.id === id ? { ...d, status } : d));
    } catch (error: any) {
      toast.error(error?.message ?? 'No se pudo actualizar');
    }
  };

  const applyBulk = async (status: ContactStatus) => {
    if (selected.length === 0) return;
    try {
      await bulkStatus.mutateAsync({ ids: selected, status });
      toast.success(
        `${selected.length} ${selected.length === 1 ? 'mensaje actualizado' : 'mensajes actualizados'}`,
      );
      setSelected([]);
    } catch (error: any) {
      toast.error(error?.message ?? 'No se pudo actualizar la selección');
    }
  };

  return (
    <Container className="p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-x-2">
          <Heading>Contacto</Heading>
          <Badge size="2xsmall" color="grey" rounded="full" title="Plugin version">
            v{PLUGIN_VERSION}
          </Badge>
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          {count} {count === 1 ? 'mensaje' : 'mensajes'}
        </Text>
      </div>
      <SiteScopeBar screen="contact-submissions" />

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-ui-border-base border-y bg-ui-bg-subtle px-6 py-3">
          <Text size="small" weight="plus">
            {selected.length} seleccionado{selected.length === 1 ? '' : 's'}
          </Text>
          <div className="flex flex-wrap gap-2">
            <Button size="small" variant="secondary" isLoading={bulkStatus.isPending} onClick={() => applyBulk('read')}>
              Marcar como leído
            </Button>
            <Button size="small" variant="secondary" isLoading={bulkStatus.isPending} onClick={() => applyBulk('new')}>
              Marcar como no leído
            </Button>
            <Button size="small" variant="secondary" isLoading={bulkStatus.isPending} onClick={() => applyBulk('archived')}>
              Archivar
            </Button>
          </div>
          <Button size="small" variant="transparent" onClick={() => setSelected([])}>
            Limpiar
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="px-6 py-10">
          <Text className="text-ui-fg-subtle">…</Text>
        </div>
      ) : items.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <Text className="text-ui-fg-subtle">Todavía no hay mensajes de contacto.</Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell className="w-[40px]">
                <Checkbox
                  checked={allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false}
                  onCheckedChange={toggleAll}
                  aria-label="Seleccionar todos"
                />
              </Table.HeaderCell>
              <Table.HeaderCell>Nombre</Table.HeaderCell>
              <Table.HeaderCell>Email</Table.HeaderCell>
              <Table.HeaderCell>Teléfono</Table.HeaderCell>
              <Table.HeaderCell>Mensaje</Table.HeaderCell>
              <Table.HeaderCell>Estado</Table.HeaderCell>
              <Table.HeaderCell>Fecha</Table.HeaderCell>
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {items.map((c) => (
              <Table.Row key={c.id} className="cursor-pointer" onClick={() => setDetail(c)}>
                <Table.Cell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selected.includes(c.id)}
                    onCheckedChange={() => toggleOne(c.id)}
                    aria-label={`Seleccionar ${c.first_name}`}
                  />
                </Table.Cell>
                <Table.Cell>
                  {c.first_name} {c.last_name}
                </Table.Cell>
                <Table.Cell>{c.email}</Table.Cell>
                <Table.Cell>{c.phone || '-'}</Table.Cell>
                <Table.Cell>
                  <span className="block max-w-[280px] truncate text-ui-fg-subtle" title={c.message}>
                    {c.message}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <StatusBadge color={STATUS_COLOR[c.status]}>
                    {STATUS_LABEL[c.status]}
                  </StatusBadge>
                </Table.Cell>
                <Table.Cell>
                  {c.created_at ? new Date(c.created_at).toLocaleDateString('es-AR') : '-'}
                </Table.Cell>
                <Table.Cell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenu.Trigger asChild>
                      <IconButton variant="transparent">
                        <EllipsisHorizontal />
                      </IconButton>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content>
                      <DropdownMenu.Item onClick={() => setDetail(c)}>Ver detalle</DropdownMenu.Item>
                      <DropdownMenu.Separator />
                      {c.status !== 'read' ? (
                        <DropdownMenu.Item onClick={() => setStatus(c.id, 'read')}>
                          Marcar como leído
                        </DropdownMenu.Item>
                      ) : (
                        <DropdownMenu.Item onClick={() => setStatus(c.id, 'new')}>
                          Marcar como no leído
                        </DropdownMenu.Item>
                      )}
                      <DropdownMenu.Item onClick={() => setStatus(c.id, 'archived')}>
                        Archivar
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}

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

      <ContactDetail contact={detail} onClose={() => setDetail(null)} onStatus={setStatus} />
      <Toaster />
    </Container>
  );
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Text size="xsmall" weight="plus" className="text-ui-fg-subtle">
        {label}
      </Text>
      {children}
    </div>
  );
}

const ContactIcon = () => <ChatBubbleLeftRightSolid style={{ color: '#EC4899' }} />;

export const config = defineRouteConfig({
  label: 'Contacto',
  icon: ContactIcon,
});

export const handle = {
  breadcrumb: () => 'Contacto',
};

export default ContactPage;
