import { DrawerTabs } from '../../../components/drawer-tabs';
import { EllipsisHorizontal } from '@medusajs/icons';
import { LogoUploader } from '../../../components/common/logo-uploader';
import {
  Badge,
  Button,
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
  usePrompt,
} from '@medusajs/ui';
import { type ReactNode, useEffect, useState } from 'react';
import FiscalDocsTab from './fiscal-docs-tab';
import {
  type Corporate,
  type CorporateRole,
  type CorporateStatus,
  useAddMember,
  useCorporate,
  useCustomerGroupLink,
  useCustomerGroups,
  useDeleteMember,
  useSetCorporateStatus,
  useUpdateCorporate,
  useUpdateMember,
} from '../../../hooks/api/corporates';

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

const MEMBER_STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  invited: 'Invitado',
  disabled: 'Inactivo',
};

const ROLE_LABELS: Record<string, string> = {
  owner: 'Dueño',
  admin: 'Administrador',
  buyer: 'Comprador',
  viewer: 'Lector',
};

type Tab = 'general' | 'members' | 'commercial' | 'fiscal';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'members', label: 'Miembros' },
  { id: 'commercial', label: 'Comercial' },
  { id: 'fiscal', label: 'Documentación Fiscal' },
];

export default function CorporateDetail({
  corporate,
  onClose,
}: {
  corporate: Corporate | null;
  onClose: () => void;
}) {
  const id = corporate?.id ?? '';
  const { data } = useCorporate(id, !!corporate);
  const [tab, setTab] = useState<Tab>('general');

  return (
    <Drawer open={!!corporate} onOpenChange={(v) => !v && onClose()}>
      <Drawer.Content className="z-50">
        <Drawer.Header>
          <div className="flex items-center gap-2">
            <Heading>{corporate?.name}</Heading>
            {corporate ? (
              <StatusBadge color={STATUS_COLORS[corporate.status]}>
                {STATUS_LABELS[corporate.status] ?? corporate.status}
              </StatusBadge>
            ) : null}
          </div>
        </Drawer.Header>
        <Drawer.Body className="overflow-y-auto overflow-x-hidden">
          <DrawerTabs tabs={TABS} tab={tab} setTab={setTab} />

          {!data ? (
            <Text className="text-ui-fg-subtle">Cargando…</Text>
          ) : tab === 'general' ? (
            <GeneralTab corporate={data.corporate} />
          ) : tab === 'members' ? (
            <MembersTab id={id} members={data.corporate.members} />
          ) : tab === 'commercial' ? (
            <CommercialTab corporate={data.corporate} />
          ) : (
            <FiscalDocsTab ownerType="corporate" ownerId={id} defaultCuit={data.corporate.tax_id} />
          )}
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  );
}

function GeneralTab({ corporate }: { corporate: Corporate }) {
  const update = useUpdateCorporate(corporate.id);
  const setStatus = useSetCorporateStatus(corporate.id);
  const [form, setForm] = useState({
    name: corporate.name,
    legal_name: corporate.legal_name ?? '',
    tax_id: corporate.tax_id ?? '',
    email_domain: corporate.email_domain ?? '',
  });
  useEffect(() => {
    setForm({
      name: corporate.name,
      legal_name: corporate.legal_name ?? '',
      tax_id: corporate.tax_id ?? '',
      email_domain: corporate.email_domain ?? '',
    });
  }, [corporate]);

  const save = async () => {
    try {
      await update.mutateAsync(form);
      toast.success('Empresa actualizada');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const changeStatus = async (s: CorporateStatus) => {
    try {
      await setStatus.mutateAsync(s);
      toast.success(`Estado: ${s}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Field label="Nombre">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="Razón social">
        <Input
          value={form.legal_name}
          onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
        />
      </Field>
      <Field label="CUIT / Tax ID">
        <Input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} />
      </Field>
      <Field label="Dominio de email">
        <Input
          placeholder="empresa.com"
          value={form.email_domain}
          onChange={(e) => setForm({ ...form, email_domain: e.target.value })}
        />
      </Field>
      <Field label="Logo de la empresa">
        <LogoUploader
          value={
            ((corporate as { metadata?: Record<string, unknown> | null }).metadata?.logo as string) ??
            undefined
          }
          onChange={async (url) => {
            try {
              const meta = (corporate as { metadata?: Record<string, unknown> | null }).metadata ?? {};
              await update.mutateAsync({ metadata: { ...meta, logo: url } } as any);
              toast.success(url ? 'Logo actualizado' : 'Logo quitado');
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        />
      </Field>
      <div className="flex justify-end">
        <Button size="small" onClick={save} isLoading={update.isPending}>
          Guardar
        </Button>
      </div>

      <div className="mt-2 border-ui-border-base border-t pt-3">
        <Text size="small" weight="plus" className="mb-2">
          Estado
        </Text>
        <div className="flex flex-wrap gap-2">
          <Button size="small" variant="secondary" onClick={() => changeStatus('active')}>
            Activar
          </Button>
          <Button size="small" variant="secondary" onClick={() => changeStatus('suspended')}>
            Suspender
          </Button>
          <Button size="small" variant="secondary" onClick={() => changeStatus('pending')}>
            Pendiente
          </Button>
          <Button size="small" variant="danger" onClick={() => changeStatus('archived')}>
            Archivar
          </Button>
        </div>
      </div>
    </div>
  );
}

function MembersTab({
  id,
  members,
}: {
  id: string;
  members: Array<{ id: string; customer_id: string; role: CorporateRole; status: string; email?: string | null; first_name?: string | null; last_name?: string | null }>;
}) {
  const add = useAddMember(id);
  const update = useUpdateMember(id);
  const del = useDeleteMember(id);
  const prompt = usePrompt();
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', password: '' });

  const onAdd = async () => {
    if (!/.+@.+\..+/.test(form.email)) {
      toast.error('Ingresá un email válido.');
      return;
    }
    if (form.password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    try {
      // El backend crea la cuenta (auth + customer) para que el cliente pueda iniciar sesión.
      await add.mutateAsync({
        email: form.email.trim(),
        first_name: form.first_name.trim() || undefined,
        last_name: form.last_name.trim() || undefined,
        phone: form.phone.trim() || undefined,
        password: form.password,
        role: 'buyer',
      });
      setForm({ first_name: '', last_name: '', email: '', phone: '', password: '' });
      toast.success('Cliente creado. Ya puede iniciar sesión con su email y contraseña.');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-lg border border-ui-border-base p-3">
        <Text size="xsmall" weight="plus">Agregar comprador</Text>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Field label="Nombre">
            <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
          </Field>
          <Field label="Apellido">
            <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" placeholder="cliente@empresa.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Teléfono (opcional)">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Contraseña">
            <Input type="password" placeholder="Mínimo 8 caracteres" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Text size="xsmall" className="text-ui-fg-subtle">
            Los miembros se agregan como compradores (clientes tradicionales).
          </Text>
          <Button size="small" onClick={onAdd} isLoading={add.isPending}>
            Agregar
          </Button>
        </div>
      </div>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Email</Table.HeaderCell>
            <Table.HeaderCell>Rol</Table.HeaderCell>
            <Table.HeaderCell>Estado</Table.HeaderCell>
            <Table.HeaderCell> </Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {members.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={4}>Sin miembros.</Table.Cell>
            </Table.Row>
          ) : (
            members.map((m) => {
              const fullName = [m.first_name, m.last_name].filter(Boolean).join(' ');
              return (
                <Table.Row key={m.id}>
                  <Table.Cell>
                    <Text size="small">{m.email ?? m.customer_id}</Text>
                    {fullName ? <Text size="xsmall" className="text-ui-fg-subtle">{fullName}</Text> : null}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge size="2xsmall" color={m.role === 'owner' ? 'purple' : 'grey'}>
                      {ROLE_LABELS[m.role] ?? m.role}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge color={m.status === 'active' ? 'green' : 'grey'}>
                      {MEMBER_STATUS_LABELS[m.status] ?? m.status}
                    </StatusBadge>
                  </Table.Cell>
                  <Table.Cell>
                    {m.role !== 'owner' ? (
                      <div className="flex justify-end">
                        <DropdownMenu>
                          <DropdownMenu.Trigger asChild>
                            <IconButton variant="transparent"><EllipsisHorizontal /></IconButton>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Content className="z-[60]">
                            {(['admin', 'buyer', 'viewer'] as CorporateRole[])
                              .filter((r) => r !== m.role)
                              .map((r) => (
                                <DropdownMenu.Item key={r} onClick={() => update.mutate({ memberId: m.id, role: r })}>
                                  Cambiar a {ROLE_LABELS[r]}
                                </DropdownMenu.Item>
                              ))}
                            <DropdownMenu.Separator />
                            {m.status === 'active' ? (
                              <DropdownMenu.Item onClick={() => update.mutate({ memberId: m.id, status: 'disabled' })}>
                                Desactivar
                              </DropdownMenu.Item>
                            ) : (
                              <DropdownMenu.Item onClick={() => update.mutate({ memberId: m.id, status: 'active' })}>
                                Activar
                              </DropdownMenu.Item>
                            )}
                            <DropdownMenu.Separator />
                            <DropdownMenu.Item
                              className="text-ui-fg-error"
                              onClick={async () => {
                                const ok = await prompt({ title: 'Quitar miembro', description: '¿Quitar este miembro de la empresa?', confirmText: 'Quitar', cancelText: 'Cancelar' });
                                if (ok) del.mutate(m.id);
                              }}
                            >
                              Quitar
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu>
                      </div>
                    ) : null}
                  </Table.Cell>
                </Table.Row>
              );
            })
          )}
        </Table.Body>
      </Table>
    </div>
  );
}

function CommercialTab({ corporate }: { corporate: Corporate }) {
  const link = useCustomerGroupLink(corporate.id);
  const { data: groupsData, isLoading: loadingGroups } = useCustomerGroups();
  const [groupId, setGroupId] = useState('');
  const groups = groupsData?.customer_groups ?? [];
  const linkedName = groups.find((g) => g.id === corporate.customer_group_id)?.name;

  return (
    <div className="flex flex-col gap-3">
      <Text size="small" className="text-ui-fg-subtle">
        El customer group es opcional: vinculalo solo si esta empresa necesita precios o promos
        diferenciales. Lo que segmenta por customer group (banners, promos) reaccionará solo.
      </Text>
      {corporate.customer_group_id ? (
        <div className="flex items-center justify-between rounded-lg border border-ui-border-base p-3">
          <div>
            <Text size="small" weight="plus">
              {linkedName ?? 'Grupo vinculado'}
            </Text>
            <Text size="xsmall" className="font-mono text-ui-fg-subtle">
              {corporate.customer_group_id}
            </Text>
          </div>
          <Button
            size="small"
            variant="danger"
            isLoading={link.isPending}
            onClick={() => link.mutate({ action: 'unlink' })}
          >
            Desvincular
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-ui-border-base p-3">
          <Button
            size="small"
            isLoading={link.isPending}
            onClick={() => link.mutate({ action: 'link' })}
          >
            Crear y vincular grupo nuevo
          </Button>
          <Text size="xsmall" className="text-ui-fg-subtle">
            o vincular uno existente:
          </Text>
          {loadingGroups ? (
            <Text size="xsmall" className="text-ui-fg-subtle">
              Cargando grupos…
            </Text>
          ) : groups.length === 0 ? (
            <Text size="xsmall" className="text-ui-fg-subtle">
              No hay customer groups todavía. Creá uno con el botón de arriba o desde Clientes → Grupos.
            </Text>
          ) : (
            <div className="flex items-end gap-2">
              <Select value={groupId} onValueChange={setGroupId}>
                <Select.Trigger>
                  <Select.Value placeholder="Elegí un customer group…" />
                </Select.Trigger>
                <Select.Content className="z-[60]">
                  {groups.map((g) => (
                    <Select.Item key={g.id} value={g.id}>
                      {g.name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
              <Button
                size="small"
                variant="secondary"
                disabled={!groupId}
                onClick={() => link.mutate({ action: 'link', customer_group_id: groupId })}
              >
                Vincular
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label size="xsmall">{label}</Label>
      {children}
    </div>
  );
}
