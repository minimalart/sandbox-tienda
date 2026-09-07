import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Badge, Button, Container, Heading, Input, Label, Select, Table, Text, Tooltip, toast } from '@medusajs/ui';
import { useState } from 'react';
import { ExtensionVersion } from '../../../components/common/extension-version';
import { HelpDrawer } from '../../../components/common/help-drawer';
import { SettingLabel } from '../../../components/common/setting-label';
import {
  useAdvisorAudit,
  useAdvisorConfig,
  useSaveAdvisorConfig,
  useWhatsappFunnel,
} from '../../../hooks/api/whatsapp-advisor';
import {
  useSetWhatsappMode,
  useWhatsappConversations,
} from '../../../hooks/api/whatsapp-conversations';
import { whatsappLabel } from '../../../translations/whatsapp';

/**
 * WhatsApp → Asesor: embudo, atención humana y configuración del filtrado guiado
 * (PRD §22, §26, §27).
 *
 * Va como SECCIÓN de WhatsApp y no como ítem suelto del sidebar: el asesor es
 * parte del bot, no una herramienta aparte. El sidebar anida las rutas hijas de
 * `routes/whatsapp` solo (ver `whatsapp/page.tsx`).
 *
 * Es la primera superficie que muestra actividad del bot: `runWhatsappTurn` no usa
 * el tracer del Asistente IA, así que la página Runs nunca vio un solo turno.
 */

const number = (value?: number | null) => new Intl.NumberFormat('es-AR').format(value ?? 0);
const percent = (value?: number | null) =>
  `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(value ?? 0)}%`;

const dateTime = (value?: string | null) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
};

const DIMENSION_LABELS: Record<string, string> = {
  surface: 'Superficie',
  product_type: 'Tipo de producto',
  environment: 'Ambiente',
  special_use: 'Uso especial',
  base: 'Base (agua o solvente)',
};

const STATUS_LABELS: Record<string, string> = {
  bot: 'Bot',
  pending_human: 'Espera a una persona',
  human: 'Atiende una persona',
  resolved: 'Resuelta',
};

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center gap-x-2">
      <Heading level="h2">{children}</Heading>
      {hint ? (
        <Tooltip content={hint}>
          <Badge size="2xsmall">?</Badge>
        </Tooltip>
      ) : null}
    </div>
  );
}

// ─── Embudo ───────────────────────────────────────────────────────────────────

function Funnel() {
  const [days, setDays] = useState(30);
  const { data, isLoading, isError } = useWhatsappFunnel(days);

  // La ruta del embudo la instala ai-assistant (es del bot). Sin ella se dice el
  // problema, en vez de dejar la sección cargando para siempre.
  if (isError) {
    return (
      <Container className="divide-y p-0">
        <div className="px-6 py-4">
          <SectionTitle>Embudo</SectionTitle>
          <Text className="text-ui-fg-subtle mt-2" size="small">
            No pude leer los eventos del bot. El embudo necesita el Asistente IA
            instalado, que es donde vive el bot de WhatsApp.
          </Text>
        </div>
      </Container>
    );
  }

  if (!isLoading && data && data.available === false) {
    return (
      <Container className="divide-y p-0">
        <div className="px-6 py-4">
          <SectionTitle>Embudo</SectionTitle>
          <Text className="text-ui-fg-subtle mt-2" size="small">
            {data.reason ?? 'No disponible.'}
          </Text>
        </div>
      </Container>
    );
  }

  const top = data?.funnel?.[0]?.sessions ?? 0;

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <SectionTitle hint="Se cuenta por SESION, no por mensaje: interesa cuantas conversaciones llegaron a cada paso.">
          Embudo
        </SectionTitle>
        <Select size="small" value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <Select.Trigger className="w-32">
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="7">7 días</Select.Item>
            <Select.Item value="30">30 días</Select.Item>
            <Select.Item value="90">90 días</Select.Item>
          </Select.Content>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 px-6 py-4 md:grid-cols-3">
        <div>
          <Text size="small" className="text-ui-fg-subtle">
            Conversaciones de compra que generan checkout
          </Text>
          <Heading level="h1">{percent(data?.kpi?.checkout_rate)}</Heading>
          <Text size="xsmall" className="text-ui-fg-muted">
            {number(data?.kpi?.checkout_sessions)} de {number(data?.kpi?.commercial_sessions)} — es
            el KPI principal del PRD
          </Text>
        </div>
        <div>
          <Text size="small" className="text-ui-fg-subtle">
            Sesiones resueltas sin IA
          </Text>
          <Heading level="h1">{percent(data?.without_ai?.percent)}</Heading>
          <Text size="xsmall" className="text-ui-fg-muted">
            {number(data?.without_ai?.sessions)} sesiones sin una sola llamada al modelo
          </Text>
        </div>
        <div>
          <Text size="small" className="text-ui-fg-subtle">
            Sin resultados / derivaciones
          </Text>
          <Heading level="h1">
            {number(data?.no_results)} / {number(data?.handoffs)}
          </Heading>
          <Text size="xsmall" className="text-ui-fg-muted">
            {number(data?.relaxed)} veces se relajó la preferencia de base
          </Text>
          {/* Un bot pausado se ve igual que uno roto desde afuera: si hay mensajes
              caídos por atención manual, hay que poder verlo acá. */}
          {(data?.paused_drops ?? 0) > 0 ? (
            <Text size="xsmall" className="text-ui-fg-muted">
              {number(data?.paused_drops)} mensaje/s sin respuesta por atención manual
            </Text>
          ) : null}
        </div>
      </div>

      <div className="px-6 py-4">
        {isLoading ? (
          <Text size="small" className="text-ui-fg-subtle">
            Cargando…
          </Text>
        ) : (
          <div className="flex flex-col gap-y-2">
            {(data?.funnel ?? []).map((stage) => (
              <div key={stage.key} className="flex items-center gap-x-3">
                <Text size="small" className="w-48 shrink-0">
                  {stage.label}
                </Text>
                <div className="bg-ui-bg-subtle h-6 flex-1 overflow-hidden rounded">
                  <div
                    className="bg-ui-tag-blue-icon h-full"
                    style={{ width: `${top ? (stage.sessions / top) * 100 : 0}%` }}
                  />
                </div>
                <Text size="small" className="w-28 shrink-0 text-right">
                  {number(stage.sessions)} ({percent(stage.percent_of_total)})
                </Text>
              </div>
            ))}
          </div>
        )}
        {data?.truncated ? (
          <Text size="xsmall" className="text-ui-fg-muted mt-3">
            Se leyó el tope de eventos: los números son de la ventana más reciente, no de todo el
            período.
          </Text>
        ) : null}
        {data?.legacy_sessions ? (
          <Text size="xsmall" className="text-ui-fg-muted mt-1">
            {number(data.legacy_sessions)} sesiones agrupadas por teléfono y día (eventos anteriores
            al estado de sesión).
          </Text>
        ) : null}
      </div>

      {Object.keys(data?.abandoned_by_step ?? {}).length > 0 ? (
        <div className="px-6 py-4">
          <Text weight="plus" size="small">
            Abandono por pregunta del asesor
          </Text>
          <Text size="xsmall" className="text-ui-fg-muted mb-2">
            Sesiones que respondieron esa pregunta y nunca llegaron a ver productos.
          </Text>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data!.abandoned_by_step!).map(([step, count]) => (
              <Badge key={step} size="small">
                {DIMENSION_LABELS[step] ?? step}: {number(count)}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </Container>
  );
}

// ─── Atención humana ──────────────────────────────────────────────────────────

/**
 * Panel de atención humana (§22). Los hooks existían desde el PR del handoff pero
 * NADIE los usaba: el operador podía escalar y el bot se pausaba, pero no había
 * forma de devolver la conversación al bot desde el admin.
 */
function HumanHandoff() {
  const { data, isLoading, isError } = useWhatsappConversations();
  const setMode = useSetWhatsappMode({
    onSuccess: (result) => {
      toast.success(result.action === 'pause' ? 'La atiende una persona.' : 'Volvió al bot.');
    },
    onError: () => toast.error('No se pudo cambiar el modo de la conversación.'),
  });

  const conversations = data?.conversations ?? [];
  const paused = conversations.filter((c) => c.status === 'pending_human' || c.status === 'human');

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Sin `hint`: lo que decía —que el bot se calla mientras atiende una persona
            y que la conversación vuelve sola por inactividad— está en el drawer,
            sección "Cuando una persona toma la conversación", junto al botón de ayuda
            del header. El tooltip lo repetía en cada visita a la página. */}
        <SectionTitle>Atención humana</SectionTitle>
        <Badge size="small">{paused.length} en atención</Badge>
      </div>
      <div className="px-6 py-4">
        {isError ? (
          <Text size="small" className="text-ui-fg-subtle">
            No pude leer las conversaciones. La atención humana necesita el
            Asistente IA instalado, que es donde vive el bot de WhatsApp.
          </Text>
        ) : isLoading ? (
          <Text size="small" className="text-ui-fg-subtle">
            Cargando…
          </Text>
        ) : conversations.length === 0 ? (
          <Text size="small" className="text-ui-fg-subtle">
            No hay conversaciones registradas todavía.
          </Text>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Teléfono</Table.HeaderCell>
                <Table.HeaderCell>Estado</Table.HeaderCell>
                <Table.HeaderCell>Motivo</Table.HeaderCell>
                <Table.HeaderCell>Última actividad</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {conversations.map((row) => {
                const isPaused = row.status === 'pending_human' || row.status === 'human';
                return (
                  <Table.Row key={row.id}>
                    <Table.Cell>{row.phone}</Table.Cell>
                    <Table.Cell>
                      <Badge size="2xsmall" color={isPaused ? 'orange' : 'green'}>
                        {STATUS_LABELS[row.status] ?? row.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell className="text-ui-fg-subtle">
                      {row.escalation_reason ?? '—'}
                    </Table.Cell>
                    <Table.Cell className="text-ui-fg-subtle">{dateTime(row.updated_at)}</Table.Cell>
                    <Table.Cell className="text-right">
                      <Button
                        size="small"
                        variant="secondary"
                        isLoading={setMode.isPending}
                        onClick={() =>
                          setMode.mutate({ phone: row.phone, action: isPaused ? 'resume' : 'pause' })
                        }
                      >
                        {isPaused ? 'Devolver al bot' : 'Atender yo'}
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        )}
      </div>
    </Container>
  );
}

// ─── Configuración + auditoría ────────────────────────────────────────────────

function AdvisorSettings() {
  const { data, isLoading, isError } = useAdvisorConfig();
  const save = useSaveAdvisorConfig({
    onSuccess: () =>
      toast.success('Config guardada. Re-sincronizá Typesense para que se aplique al índice.'),
    onError: () => toast.error('No se pudo guardar la config.'),
  });
  const [channelId, setChannelId] = useState('');
  const audit = useAdvisorAudit(channelId || undefined);

  const config = data?.config;
  const [draft, setDraft] = useState<{ max_results?: string; show_threshold?: string; max_questions?: string }>({});

  const value = (key: 'max_results' | 'show_threshold' | 'max_questions'): string =>
    draft[key] ?? String(config?.[key] ?? '');

  const onSave = () => {
    save.mutate({
      max_results: Number(value('max_results')),
      show_threshold: Number(value('show_threshold')),
      max_questions: Number(value('max_questions')),
    });
  };

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Mismo criterio que "Atención humana": la regla de re-sincronizar Typesense
            después de tocar el vocabulario está en el drawer, sección "Medición por
            tienda y del asesor". */}
        <SectionTitle>Configuración del asesor</SectionTitle>
        {config ? <Badge size="small">reglas v{config.rules.version}</Badge> : null}
      </div>

      {isError ? (
        // Los endpoints del asesor los instala la extensión Typesense (el filtrado
        // guiado es búsqueda por facetas). Sin ella, la página lo dice en vez de
        // quedarse cargando para siempre.
        <div className="px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">
            No pude leer la configuración del asesor. El filtrado guiado necesita la extensión
            Typesense instalada y sincronizada.
          </Text>
        </div>
      ) : isLoading ? (
        <div className="px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">
            Cargando…
          </Text>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 px-6 py-4 md:grid-cols-3">
            <div className="flex flex-col gap-y-1">
              <Label size="small">Máximo de productos a mostrar</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={value('max_results')}
                onChange={(e) => setDraft((d) => ({ ...d, max_results: e.target.value }))}
              />
              <Text size="xsmall" className="text-ui-fg-muted">
                WhatsApp permite hasta 10 filas o tarjetas.
              </Text>
            </div>
            <div className="flex flex-col gap-y-1">
              <Label size="small">Umbral para mostrar sin preguntar más</Label>
              <Input
                type="number"
                min={1}
                value={value('show_threshold')}
                onChange={(e) => setDraft((d) => ({ ...d, show_threshold: e.target.value }))}
              />
              <Text size="xsmall" className="text-ui-fg-muted">
                Con esta cantidad de resultados o menos, se muestran.
              </Text>
            </div>
            <div className="flex flex-col gap-y-1">
              <Label size="small">Tope de preguntas</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={value('max_questions')}
                onChange={(e) => setDraft((d) => ({ ...d, max_questions: e.target.value }))}
              />
              <Text size="xsmall" className="text-ui-fg-muted">
                Al llegar al tope se muestran productos igual.
              </Text>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-6 py-4">
            <Button size="small" onClick={onSave} isLoading={save.isPending}>
              Guardar
            </Button>
            <Button
              size="small"
              variant="secondary"
              isLoading={save.isPending}
              onClick={() => save.mutate({ seed: true, force: true })}
            >
              Recargar vocabulario por defecto
            </Button>
            <Text size="xsmall" className="text-ui-fg-muted">
              Reglas cargadas: {Object.keys(config?.rules.by_category_code ?? {}).length} categorías,{' '}
              {Object.keys(config?.rules.by_family ?? {}).length} familias,{' '}
              {config?.rules.by_title_keyword.length ?? 0} de título.
            </Text>
          </div>

          <div className="px-6 py-4">
            {/* El párrafo que decía esto vivía debajo del rótulo y empujaba dos renglones
                antes de llegar al botón "Auditar", que es lo único accionable del bloque.
                Es la explicación de un CONTROL y no de la extensión, así que va al tooltip
                del rótulo y no al drawer. */}
            <SettingLabel
              label="Cobertura del catálogo"
              hint="Corre el clasificador sobre el catálogo y dice qué porcentaje quedó clasificado. Si una dimensión queda casi toda sin clasificar, preguntar por ella no sirve."
              size="small"
              weight="plus"
            />
            <div className="mb-3 mt-2 flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-y-1">
                <Label size="xsmall">Canal de venta (opcional)</Label>
                <Input
                  className="w-72"
                  placeholder="sc_…"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                />
              </div>
              <Button
                size="small"
                variant="secondary"
                isLoading={audit.isFetching}
                onClick={() => audit.refetch()}
              >
                Auditar
              </Button>
            </div>

            {audit.data ? (
              <div className="flex flex-col gap-y-3">
                <Text size="small">
                  {number(audit.data.total)} productos analizados (reglas v{audit.data.rules_version}
                  ).
                </Text>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(audit.data.coverage).map(([dimension, info]) => (
                    <Badge key={dimension} size="small">
                      {DIMENSION_LABELS[dimension] ?? dimension}:{' '}
                      {info.measured
                        ? `${percent(info.percent)} clasificado`
                        : `${number(info.assigned)} con valor`}
                    </Badge>
                  ))}
                </div>
                {audit.data.unmapped_categories.length > 0 ? (
                  <div>
                    <Text size="xsmall" weight="plus">
                      Categorías sin regla
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {audit.data.unmapped_categories
                        .slice(0, 12)
                        .map((c) => `${c.code}${c.name ? ` (${c.name})` : ''} · ${c.products}`)
                        .join('  —  ')}
                    </Text>
                  </div>
                ) : null}
                {audit.data.unmapped_families.length > 0 ? (
                  <div>
                    <Text size="xsmall" weight="plus">
                      Familias sin regla
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {audit.data.unmapped_families
                        .slice(0, 12)
                        .map((f) => `${f.name} · ${f.products}`)
                        .join('  —  ')}
                    </Text>
                  </div>
                ) : null}
              </div>
            ) : (
              <Text size="xsmall" className="text-ui-fg-muted">
                Todavía no se corrió. Puede tardar unos segundos con catálogos grandes.
              </Text>
            )}
          </div>
        </>
      )}
    </Container>
  );
}

const WhatsappAdvisorPage = () => (
  <div className="flex flex-col gap-y-3">
    <Container className="flex items-center justify-between">
      <div>
        <Heading>{whatsappLabel('NAV_ADVISOR')}</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Embudo comercial, atención humana y configuración del filtrado guiado.
        </Text>
      </div>
      {/* El drawer va acá y no sólo en Ajustes porque es de acá de donde se sacaron
          los dos `hint` de abajo: quitarle a esta pantalla su explicación sin dejarle
          la puerta al drawer sería esconder el texto, no mudarlo. */}
      <div className="flex items-center gap-x-2">
        <ExtensionVersion extension="whatsapp" />
        <HelpDrawer slug="whatsapp" />
      </div>
    </Container>
    <Funnel />
    <HumanHandoff />
    <AdvisorSettings />
  </div>
);

// Sin `icon`: el icono lo pone el padre (`whatsapp/page.tsx`) y las hijas van
// anidadas. `rank` la ubica entre Plantillas (1) y Ajustes (3). Label e
// breadcrumb resueltos por idioma persistido, igual que las hermanas.
export const config = defineRouteConfig({
  label: whatsappLabel('NAV_ADVISOR'),
  rank: 2,
});

export const handle = {
  breadcrumb: () => whatsappLabel('NAV_ADVISOR'),
};

export default WhatsappAdvisorPage;
