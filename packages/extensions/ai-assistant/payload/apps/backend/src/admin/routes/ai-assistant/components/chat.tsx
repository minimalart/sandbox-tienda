import { DatePicker, IconButton, Select, toast, Tooltip, usePrompt } from '@medusajs/ui';
import { Plus, SparklesSolid, Trash, XMarkMini } from '@medusajs/icons';
import { Fragment, useEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { sdk } from '../../../lib/client';
import {
  streamMessage,
  useAgents,
  useConfirmTools,
  useCreateThread,
  useDeleteThread,
  useMe,
  useThread,
  useThreads,
  type Agent,
  type ChatAttachment,
  type Message,
  type PendingToolCall,
  type TimelineItem,
  type WorkflowActivity,
  type WorkflowChecklistItem,
} from '../hooks';
import { MODEL_OPTIONS, SUGGESTIONS_BY_SKILL } from '../lib/suggestions';
import { PERIOD_OPTIONS, periodFromPreset, isoDate, type PeriodPreset } from '../lib/period';
import { parseSalesUiPayload, stripSalesUiPayload } from '../lib/visuals';
import { parseAskOptions, stripAskOptions } from '../lib/options';
import { parseCampaignBlock, stripCampaignBlocks } from '../lib/campaign-blocks';
import { CampaignBlockView } from './campaign-blocks';
import { VisualRenderer } from './visual-renderer';
import { AgentAvatar, colorForKey } from './agent-avatar';

function ArrowUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 19V5M12 5l-6 6M12 5l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Ícono de clip para adjuntar archivos. */
function Paperclip() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21.44 11.05l-8.49 8.49a5.5 5.5 0 01-7.78-7.78l8.49-8.49a3.67 3.67 0 115.19 5.19l-8.5 8.49a1.83 1.83 0 11-2.59-2.59l7.85-7.84"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Ícono de documento (chips de adjuntos no-imagen). */
function DocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

/** Adjunto en composición: se sube apenas se elige; `url` queda cuando termina. */
type PendingAttachment = {
  id: string;
  kind: 'image' | 'document';
  filename: string;
  mime_type: string;
  /** Object URL local para previsualizar imágenes mientras suben. */
  previewUrl?: string;
  url?: string;
  file_id?: string | null;
  uploading: boolean;
  error?: boolean;
};

function kindFromMime(mime: string): 'image' | 'document' {
  return mime.startsWith('image/') ? 'image' : 'document';
}

/** MIME del archivo; si el browser no lo da (común en .txt/.md), se infiere por extensión. */
function inferMimeFromName(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'md' || ext === 'markdown') return 'text/markdown';
  if (ext === 'txt') return 'text/plain';
  return 'application/octet-stream';
}

const ATTACH_ACCEPT = 'image/*,application/pdf,text/plain,text/markdown,.pdf,.txt,.md';

/** Normaliza para matchear menciones `@agente`: minúsculas y sin tildes. */
function normalizeMention(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Texto de un mensaje del usuario con la mención `@Agente` destacada.
 *
 * `doSend` antepone `@Nombre` al texto para que la cita quede visible al
 * recargar el hilo, pero renderizado como texto plano se confunde con el
 * mensaje: se lee "@Cata cual es el producto mas caro?" como una sola frase.
 *
 * El largo del recorte se toma de la cadena ORIGINAL, no de la normalizada:
 * `normalizeMention` descompone y saca tildes, así que puede cambiar el largo
 * y desalinear el slice.
 */
function UserText({
  content,
  agents,
}: {
  content: string;
  agents: Array<{ key: string; name: string }>;
}) {
  const hit = useMemo(() => {
    // Candidatos del más largo al más corto: si no, "@catalogo" matchea con el
    // nombre "Cata" y el chip se come media palabra ("logo revisá el stock").
    const needles = agents
      .flatMap((a) => [a.name, a.key])
      .filter(Boolean)
      .sort((x, y) => y.length - x.length);
    for (const raw of needles) {
      const needle = `@${raw}`;
      if (normalizeMention(content.slice(0, needle.length)) !== normalizeMention(needle)) continue;
      // Límite de palabra: la mención termina donde termina el texto o con un
      // espacio. Sin esto "@Catalina" se leería como "@Cata" + "lina".
      const after = content[needle.length];
      if (after !== undefined && !/\s/.test(after)) continue;
      return needle.length;
    }
    return null;
  }, [content, agents]);

  if (hit === null) return <>{content}</>;
  return (
    <>
      {/* Se muestra lo que la persona escribió, no el nombre canónico: es su mensaje. */}
      <span className="mr-1 inline-flex items-center rounded-md bg-ui-tag-blue-bg px-1.5 py-0.5 font-medium text-ui-tag-blue-text">
        {content.slice(0, hit)}
      </span>
      {content.slice(hit).replace(/^\s+/, '')}
    </>
  );
}

/**
 * Mención en edición en el composer: la `@` que arranca palabra más cercana al
 * caret, con lo tipeado después como query. null = no hay mención en edición
 * (sin `@`, con salto de línea en el medio, o quedó demasiado larga).
 */
function getMentionContext(
  value: string,
  caret: number,
): { start: number; query: string } | null {
  const upto = value.slice(0, caret);
  const at = upto.lastIndexOf('@');
  if (at < 0) return null;
  if (at > 0 && !/\s/.test(upto[at - 1])) return null;
  const query = upto.slice(at + 1);
  if (query.includes('\n') || query.length > 40) return null;
  return { start: at, query };
}

/** Ícono de panel lateral (toggle de la lista de hilos). */
function PanelToggle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <line x1="9" y1="4.5" x2="9" y2="19.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' }}
    >
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Avatar genérico (fallback de un solo agente o agente desconocido). */
function Avatar() {
  return (
    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-ui-border-base bg-ui-bg-base text-ui-fg-subtle">
      <SparklesSolid />
    </div>
  );
}

/**
 * Grupo de avatares del equipo (estilo "avatar group"): los agentes superpuestos
 * para que el vacío del chat muestre que hay un equipo detrás, no un solo bot.
 * Sin agentes (raro), cae al ícono genérico.
 */
function AgentAvatarGroup({ agents, max = 5 }: { agents: Agent[]; max?: number }) {
  if (agents.length === 0) {
    return (
      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-ui-border-base bg-ui-bg-base text-ui-fg-subtle">
        <SparklesSolid />
      </div>
    );
  }
  const shown = agents.slice(0, max);
  const rest = agents.slice(max);
  return (
    <div className="flex items-center">
      {shown.map((a, i) => (
        <Tooltip key={a.id} content={a.name}>
          <div className={i === 0 ? '' : '-ml-3'}>
            <AgentAvatar agent={a} size={44} className="ring-2 ring-ui-bg-subtle" />
          </div>
        </Tooltip>
      ))}
      {rest.length > 0 ? (
        <Tooltip content={rest.map((a) => a.name).join(', ')}>
          <div className="-ml-3 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ui-bg-base ring-2 ring-ui-bg-subtle txt-compact-small-plus text-ui-fg-subtle">
            +{rest.length}
          </div>
        </Tooltip>
      ) : null}
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-ui-fg-muted"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </div>
  );
}

/**
 * Barra de presencia del equipo: los agentes habilitados como un roster, con el
 * que está atendiendo el hilo resaltado y, si está en curso, un "trabajando".
 * Es lo que hace sentir que hay un equipo (no un solo bot) detrás del chat.
 */
function TeamBar({
  agents,
  activeKey,
  working,
}: {
  agents: Agent[];
  activeKey?: string | null;
  working: boolean;
}) {
  if (agents.length === 0) return null;
  const hasActive = Boolean(activeKey);
  return (
    <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
      <span className="shrink-0 txt-compact-small text-ui-fg-muted">Equipo</span>
      <div className="flex items-center gap-1.5">
        {agents.map((a) => {
          const active = a.key === activeKey;
          const chip = (
            <div
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-1.5 py-0.5 transition-colors ${
                active ? 'border-ui-border-interactive bg-ui-bg-base' : 'border-transparent'
              }`}
            >
              <AgentAvatar agent={a} size={20} dimmed={!active && hasActive} />
              <span className={`txt-compact-small ${active ? 'text-ui-fg-base' : 'text-ui-fg-subtle'}`}>
                {a.name}
              </span>
              {active && working ? (
                <span className="flex items-center gap-1 txt-small text-ui-fg-muted">
                  <span
                    className="h-1.5 w-1.5 animate-pulse rounded-full"
                    style={{ backgroundColor: '#1D9E75' }}
                  />
                  trabajando
                </span>
              ) : null}
            </div>
          );
          return a.description ? (
            <Tooltip key={a.id} content={a.description}>
              {chip}
            </Tooltip>
          ) : (
            <Fragment key={a.id}>{chip}</Fragment>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Razonamiento en vivo (EFÍMERO): se muestra mientras el modelo piensa y
 * desaparece cuando empieza la respuesta / se cierra el turno. No se persiste.
 */
function ReasoningPanel({ text, agent }: { text: string; agent?: Agent | null }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex gap-3">
      <div className="w-7 shrink-0">{agent ? <AgentAvatar agent={agent} size={28} dimmed /> : <Avatar />}</div>
      <div className="min-w-0 flex-1 pt-0.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 txt-compact-small text-ui-fg-subtle"
        >
          <Chevron open={open} />
          <span className="inline-flex items-center gap-1.5">
            Pensando
            <span className="flex gap-0.5">
              {[0, 150, 300].map((d) => (
                <span
                  key={d}
                  className="h-1 w-1 animate-bounce rounded-full bg-ui-fg-muted"
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </span>
          </span>
        </button>
        {open ? (
          <p className="mt-1 whitespace-pre-wrap border-l-2 border-ui-border-base pl-3 txt-small italic text-ui-fg-muted">
            {text}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Una tool que un agente ejecutó: línea compacta que deja "el trabajo" a la vista
 * dentro del hilo (persiste al recargar, no solo en vivo).
 */
function ActivityLine({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 pl-10 txt-small text-ui-fg-subtle">
      <span aria-hidden="true" style={{ color: ok ? '#1D9E75' : '#D85A30' }}>
        {ok ? '✓' : '✕'}
      </span>
      <span>{label}</span>
    </div>
  );
}

/**
 * Derivación entre agentes como una línea de diálogo: muestra `origen → destino`
 * con sus avatares y el encargo (`reason`) que el agente origen le deja al destino.
 * Es lo que hace que la colaboración se LEA como un equipo dialogando, tanto en
 * vivo (evento `handoff`) como al recargar (ítem `handoff` del timeline).
 */
function HandoffCard({ from, to, reason }: { from?: Agent | null; to?: Agent | null; reason?: string }) {
  if (!to) return null;
  return (
    <div className="flex justify-center">
      <div className="flex max-w-[85%] flex-col items-center gap-1 rounded-xl border border-ui-border-base bg-ui-bg-base px-3 py-2">
        <div className="flex items-center gap-1.5 txt-small text-ui-fg-subtle">
          {from ? (
            <>
              <AgentAvatar agent={from} size={16} />
              <span>{from.name}</span>
            </>
          ) : null}
          <span className="px-0.5 text-ui-fg-muted">→</span>
          <AgentAvatar agent={to} size={16} />
          <span className="text-ui-fg-base">{to.name}</span>
        </div>
        {reason ? <p className="text-center txt-small italic text-ui-fg-subtle">«{reason}»</p> : null}
      </div>
    </div>
  );
}

/**
 * Mensaje de texto del asistente, con un "carril" de color a la izquierda (el
 * color determinístico del agente) para que distintos agentes se lean como
 * personas distintas. `showHeader=false` agrupa mensajes consecutivos del mismo
 * agente (no repite avatar/nombre).
 */
function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Botón para copiar al portapapeles el texto de una respuesta del asistente. */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore: el navegador puede bloquear el portapapeles sin gesto/permiso */
    }
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label="Copiar respuesta"
      title={copied ? 'Copiado' : 'Copiar respuesta'}
      className={`mt-1.5 grid h-7 w-7 place-items-center rounded-md transition-colors ${
        copied ? 'text-emerald-600' : 'text-ui-fg-muted hover:bg-ui-bg-base hover:text-ui-fg-subtle'
      }`}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

function AssistantMessage({
  content,
  agent,
  showHeader = true,
  copyable = false,
}: {
  content: string;
  agent?: Agent | null;
  showHeader?: boolean;
  copyable?: boolean;
}) {
  const visuals = useMemo(() => parseSalesUiPayload(content), [content]);
  const text = useMemo(
    () => stripCampaignBlocks(stripAskOptions(stripSalesUiPayload(content))),
    [content],
  );
  const rail = agent ? colorForKey(agent.key) : undefined;
  return (
    <div className="flex gap-3">
      <div className="w-7 shrink-0">
        {showHeader ? agent ? <AgentAvatar agent={agent} size={28} /> : <Avatar /> : null}
      </div>
      <div
        className="min-w-0 flex-1 border-l-2 pl-3 pt-0.5"
        style={{ borderColor: rail ?? 'transparent' }}
      >
        {showHeader && agent ? (
          <p className="mb-0.5 txt-compact-small-plus text-ui-fg-base">{agent.name}</p>
        ) : null}
        {text ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ui-fg-base">{text}</p>
        ) : null}
        <VisualRenderer visuals={visuals} />
        {copyable && text ? <CopyButton text={text} /> : null}
      </div>
    </div>
  );
}

/** Ícono de herramienta (llave) para la tarjeta de tool-call. */
function WrenchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14.7 6.3a4 4 0 00-5.4 5.4l-6 6a1.5 1.5 0 002.1 2.1l6-6a4 4 0 005.4-5.4l-2.3 2.3-2.1-2.1 2.3-2.3z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Chevron que rota según el estado abierto/cerrado de la tarjeta. */
function CardChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 text-ui-fg-muted transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Tarjeta colapsable de una tool-call pendiente, al estilo del componente "Tool"
 * de AI SDK Elements: header con ícono + nombre + estado, y parámetros plegables.
 */
function ToolCallCard({ pending }: { pending: PendingToolCall }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-base">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-ui-bg-base-hover"
      >
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-ui-bg-component text-ui-fg-subtle">
          <WrenchIcon />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate txt-compact-small-plus text-ui-fg-base">{pending.action}</span>
          <span className="block truncate txt-small text-ui-fg-subtle">{pending.name}</span>
        </span>
        <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 txt-small font-medium text-amber-700">
          Requiere confirmación
        </span>
        <CardChevron open={open} />
      </button>
      {open ? (
        <div className="border-t border-ui-border-base bg-ui-bg-subtle px-3 py-2">
          <p className="mb-1 txt-small uppercase tracking-wide text-ui-fg-muted">Parámetros</p>
          <pre className="overflow-x-auto whitespace-pre-wrap break-words txt-small text-ui-fg-subtle">
            {JSON.stringify(pending.args, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function PendingApproval({
  pending,
  agent,
  onResolve,
  busy,
}: {
  pending: PendingToolCall[];
  agent?: Agent | null;
  onResolve: (approved: boolean) => void;
  busy: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="w-7 shrink-0">{agent ? <AgentAvatar agent={agent} size={28} /> : <Avatar />}</div>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="txt-compact-small text-ui-fg-subtle">
          {agent ? agent.name : 'El asistente'} quiere ejecutar{' '}
          {pending.length === 1 ? 'una acción' : `${pending.length} acciones`} que requieren tu confirmación.
        </p>
        <div className="flex flex-col gap-2">
          {pending.map((p) => (
            <ToolCallCard key={p.tool_call_id} pending={p} />
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            className="rounded-lg bg-ui-fg-base px-3 py-1.5 text-sm font-medium text-ui-bg-base disabled:opacity-40"
            onClick={() => onResolve(true)}
            disabled={busy}
          >
            Aprobar y ejecutar
          </button>
          <button
            type="button"
            className="rounded-lg border border-ui-border-base bg-ui-bg-base px-3 py-1.5 text-sm text-ui-fg-base disabled:opacity-40"
            onClick={() => onResolve(false)}
            disabled={busy}
          >
            Rechazar
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Checklist del workflow en curso: cada paso con el avatar de su subagente y su
 * estado. Hace visible "el equipo trabajando" dirigido por el Orquestador.
 */
/** Frases que rotan bajo el paso en curso para que la espera no sea solo un spinner. */
const WORKFLOW_HINTS: Record<string, string[]> = {
  investigador: ['Buscando recetas confiables…', 'Leyendo fuentes…', 'Extrayendo ingredientes y pasos…'],
  redactor: ['Redactando el artículo…', 'Dándole formato…', 'Creando el borrador…'],
  imagenes: ['Generando la portada…', 'Ajustando la composición…'],
  catalogo: ['Buscando productos en el catálogo…', 'Vinculando ingredientes…'],
};
const DEFAULT_HINTS = ['Trabajando…', 'Procesando…'];

/** Texto que rota cada ~2.5s según el agente del paso en curso. */
function RotatingHint({ agentKey }: { agentKey?: string | null }) {
  const phrases = (agentKey && WORKFLOW_HINTS[agentKey]) || DEFAULT_HINTS;
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    if (phrases.length <= 1) return;
    const t = setInterval(() => setI((v) => (v + 1) % phrases.length), 2500);
    return () => clearInterval(t);
  }, [agentKey]);
  return <span className="txt-small italic text-ui-fg-muted">{phrases[i] ?? phrases[0]}</span>;
}

function WorkflowChecklist({
  steps,
  getAgent,
}: {
  steps: WorkflowChecklistItem[];
  getAgent: (key?: string | null) => Agent | null;
}) {
  if (steps.length === 0) return null;
  const ICON: Record<WorkflowChecklistItem['status'], { ch: string; color: string }> = {
    pending: { ch: '○', color: '#9A9A93' },
    in_progress: { ch: '⟳', color: '#378ADD' },
    completed: { ch: '✓', color: '#1D9E75' },
    needs_input: { ch: '⚠', color: '#BA7517' },
    failed: { ch: '✕', color: '#D85A30' },
  };
  return (
    <div className="flex w-full flex-col gap-1.5 rounded-xl border border-ui-border-base bg-ui-bg-base p-3 shadow-elevation-card-hover">
      <p className="txt-compact-small-plus text-ui-fg-base">Progreso del workflow</p>
      {steps.map((s) => {
        const agent = getAgent(s.agent_key);
        const ic = ICON[s.status] ?? ICON.pending;
        return (
          <div key={s.key} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 txt-small">
              {agent ? <AgentAvatar agent={agent} size={18} dimmed={s.status === 'pending'} /> : null}
              <span
                className={`min-w-0 flex-1 truncate ${
                  s.status === 'pending' ? 'text-ui-fg-muted' : 'text-ui-fg-base'
                }`}
                title={s.result_summary || s.label}
              >
                {s.label}
              </span>
              <span
                aria-hidden="true"
                className={s.status === 'in_progress' ? 'animate-spin' : ''}
                style={{ color: ic.color }}
              >
                {ic.ch}
              </span>
            </div>
            {s.status === 'in_progress' ? (
              <span className="pl-[26px]">
                <RotatingHint agentKey={s.agent_key} />
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Ícono chico por tipo de actividad; hereda el color del contenedor. */
function ActivityKindIcon({ kind }: { kind: WorkflowActivity['kind'] }) {
  const common = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true } as const;
  switch (kind) {
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
          <path d="M20 20l-3.2-3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'source':
      return (
        <svg {...common}>
          <path
            d="M10 14a4 4 0 0 0 5.66 0l2.83-2.83a4 4 0 0 0-5.66-5.66L11.5 6.9"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M14 10a4 4 0 0 0-5.66 0L5.5 12.83a4 4 0 0 0 5.66 5.66L12.5 17.1"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'reasoning':
      return (
        <svg {...common}>
          <path
            d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .8 1.6V16h5.4v-.5c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path
            d="M14.7 6.3a4 4 0 0 0-5.4 5.2L4 16.8 7.2 20l5.3-5.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.2-.4-.4-2.2 2.6-2.6z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

/** Una fila de actividad real. Las fuentes con `url` son links clickeables. */
function ActivityRow({ act }: { act: WorkflowActivity }) {
  const label = (
    <>
      {act.label}
      {act.detail ? <span className="text-ui-fg-muted"> — {act.detail}</span> : null}
    </>
  );
  return (
    <div className="flex items-start gap-2 txt-small">
      <span aria-hidden="true" className="mt-[3px] shrink-0 text-ui-fg-muted">
        <ActivityKindIcon kind={act.kind} />
      </span>
      {act.url ? (
        <a
          href={act.url}
          target="_blank"
          rel="noreferrer"
          title={act.url}
          className="min-w-0 flex-1 truncate text-ui-fg-interactive hover:underline"
        >
          {label}
        </a>
      ) : (
        <span className="min-w-0 flex-1 text-ui-fg-subtle">{label}</span>
      )}
    </div>
  );
}

/** Un paso del workflow con su actividad real agrupada; colapsable individualmente. */
function ChainStep({
  step,
  activity,
  agent,
}: {
  step: WorkflowChecklistItem;
  activity: WorkflowActivity[];
  agent: Agent | null;
}) {
  const [open, setOpen] = useState(step.status === 'in_progress');
  // El paso en curso se abre solo al arrancar (nueva actividad en camino).
  useEffect(() => {
    if (step.status === 'in_progress') setOpen(true);
  }, [step.status]);

  const hasActivity = activity.length > 0;
  const showHint = step.status === 'in_progress' && !hasActivity;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 txt-compact-small text-ui-fg-subtle"
      >
        <Chevron open={open} />
        {agent ? <AgentAvatar agent={agent} size={16} dimmed={step.status === 'pending'} /> : null}
        <span
          className={`min-w-0 truncate ${
            step.status === 'pending' ? 'text-ui-fg-muted' : 'text-ui-fg-base'
          }`}
        >
          {step.label}
        </span>
        {hasActivity ? <span className="text-ui-fg-muted">· {activity.length}</span> : null}
        {step.status === 'in_progress' ? (
          <span aria-hidden="true" className="animate-spin" style={{ color: '#378ADD' }}>
            ⟳
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="ml-[9px] flex flex-col gap-1 border-l-2 border-ui-border-base pl-3">
          {hasActivity ? (
            activity.map((a) => <ActivityRow key={a.id} act={a} />)
          ) : showHint ? (
            // Fallback: solo ANTES de que llegue la primera actividad real de este paso.
            <RotatingHint agentKey={step.agent_key} />
          ) : (
            <span className="txt-small text-ui-fg-muted">Sin detalle.</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Cadena de pensamiento del workflow: agrupa la ACTIVIDAD REAL de cada subagente
 * (búsquedas web, fuentes clickeables, tools) por paso, colapsable. Reemplaza al
 * `RotatingHint` hardcodeado como indicador primario: las frases dummy solo aparecen
 * mientras un paso está in_progress y todavía NO llegó ninguna actividad real para él.
 */
function ChainOfThought({
  steps,
  activityByStep,
  getAgent,
}: {
  steps: WorkflowChecklistItem[];
  activityByStep: Record<string, WorkflowActivity[]>;
  getAgent: (key?: string | null) => Agent | null;
}) {
  const [open, setOpen] = useState(true);
  const totalActivity = useMemo(
    () => Object.values(activityByStep).reduce((n, a) => n + a.length, 0),
    [activityByStep],
  );
  // Solo pasos que ya arrancaron o que tienen actividad; los pendientes ya se ven en el checklist.
  const visibleSteps = steps.filter(
    (s) => s.status !== 'pending' || (activityByStep[s.key]?.length ?? 0) > 0,
  );
  if (visibleSteps.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 txt-compact-small-plus text-ui-fg-base"
      >
        <Chevron open={open} />
        <span>Cadena de pensamiento</span>
        {totalActivity > 0 ? (
          <span className="txt-compact-small text-ui-fg-muted">· {totalActivity}</span>
        ) : null}
      </button>
      {open ? (
        <div className="flex flex-col gap-2.5">
          {visibleSteps.map((s) => (
            <ChainStep
              key={s.key}
              step={s}
              activity={activityByStep[s.key] ?? []}
              agent={getAgent(s.agent_key)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Cadena de pensamiento como MENSAJE del hilo (con avatar + riel, igual que un
 * mensaje del asistente). El PROGRESO del workflow (checklist) NO va acá: vive en
 * su card flotante aparte. Solo aparece cuando ya hay actividad real de algún paso.
 */
function WorkflowChainMessage({
  steps,
  activityByStep,
  getAgent,
}: {
  steps: WorkflowChecklistItem[];
  activityByStep: Record<string, WorkflowActivity[]>;
  getAgent: (key?: string | null) => Agent | null;
}) {
  if (steps.length === 0) return null;
  const showChain = steps.some(
    (s) => s.status !== 'pending' || (activityByStep[s.key]?.length ?? 0) > 0,
  );
  if (!showChain) return null;
  const activeStep = steps.find((s) => s.status === 'in_progress');
  const agent = getAgent(activeStep?.agent_key) ?? getAgent(steps[0]?.agent_key);
  const rail = agent ? colorForKey(agent.key) : undefined;

  return (
    <div className="flex gap-3">
      <div className="w-7 shrink-0">{agent ? <AgentAvatar agent={agent} size={28} /> : <Avatar />}</div>
      <div
        className="min-w-0 flex-1 border-l-2 pl-3 pt-0.5"
        style={{ borderColor: rail ?? 'transparent' }}
      >
        <ChainOfThought steps={steps} activityByStep={activityByStep} getAgent={getAgent} />
      </div>
    </div>
  );
}

export const Chat = () => {
  const { data: threadsData } = useThreads();
  const threads = threadsData?.threads ?? [];
  const { data: agentsData } = useAgents();
  const { data: meData } = useMe();

  // Saludo personalizado: nombre del admin (o el inicio de su email como fallback).
  const rawName =
    meData?.user?.first_name?.trim() || meData?.user?.email?.split('@')[0]?.split(/[._-]/)[0] || '';
  const userName = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : '';
  const greeting = userName
    ? `Hola, ${userName} ¿en qué podemos ayudarte?`
    : '¿En qué podemos ayudarte?';

  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TimelineItem[]>([]);
  const [pending, setPending] = useState<PendingToolCall[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState(MODEL_OPTIONS[0]?.id ?? '');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('none');
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Lista de hilos colapsable (persistida): colapsada → el chat usa todo el ancho.
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ai-assistant-threads-open') !== 'false';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('ai-assistant-threads-open', String(sidebarOpen));
    } catch {
      /* ignore */
    }
  }, [sidebarOpen]);
  // Estado del streaming en vivo: texto y razonamiento que se van acumulando, qué
  // agente lo produce (para su avatar) y la actividad de tools/handoff a mostrar.
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [streamingReasoning, setStreamingReasoning] = useState('');
  const [activity, setActivity] = useState<string | null>(null);
  const [liveAgentKey, setLiveAgentKey] = useState<string | null>(null);
  // Derivaciones de este turno en vivo (para las HandoffCard mientras streamea).
  const [liveHandoffs, setLiveHandoffs] = useState<
    { from: string; target: string; reason?: string }[]
  >([]);
  // Checklist del workflow en curso (motor orquestado): se va actualizando por
  // los eventos workflow_* del stream.
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowChecklistItem[]>([]);
  // Mensajes breves de cada subagente del workflow (su "voz" como burbuja de chat,
  // en vivo durante el turno). El resultado final lo redacta el Orquestador.
  const [workflowMessages, setWorkflowMessages] = useState<{ agent_key: string; text: string }[]>([]);
  // Artefacto del workflow terminado (borrador + faltantes): persiste tras el turno como
  // card con el link de preview (NO se limpia en el finally del stream).
  const [workflowArtifact, setWorkflowArtifact] = useState<{
    preview_url?: string | null;
    post_id?: string | null;
    unmatched?: string[];
  } | null>(null);
  // Actividad real de cada paso del workflow (búsquedas, fuentes, tools), acumulada por
  // step_key desde los eventos workflow_activity. Alimenta la Cadena de pensamiento y
  // reemplaza al RotatingHint hardcodeado como indicador primario.
  const [workflowActivity, setWorkflowActivity] = useState<Record<string, WorkflowActivity[]>>({});

  // Mapa key→agente para resolver avatares/nombres por `agent_key`.
  const agentsByKey = useMemo(() => {
    const m = new Map<string, Agent>();
    for (const a of agentsData?.agents ?? []) m.set(a.key, a);
    return m;
  }, [agentsData]);
  const getAgent = (key?: string | null): Agent | null => (key ? agentsByKey.get(key) ?? null : null);
  const liveAgent = getAgent(liveAgentKey);

  // Roster del equipo: agentes habilitados, orquestador primero, luego por rank.
  const teamAgents = useMemo(
    () =>
      (agentsData?.agents ?? [])
        .filter((a) => a.enabled)
        .sort(
          (a, b) =>
            (b.is_orchestrator ? 1 : 0) - (a.is_orchestrator ? 1 : 0) || a.rank - b.rank,
        ),
    [agentsData],
  );

  // Período efectivo: presets calculados, o el rango custom de los date pickers.
  const computePeriod = (): { from: string; to: string } | null => {
    if (periodPreset === 'custom') {
      if (!customFrom || !customTo) return null;
      const a = isoDate(customFrom);
      const b = isoDate(customTo);
      return a <= b ? { from: a, to: b } : { from: b, to: a };
    }
    return periodFromPreset(periodPreset);
  };

  const { data: threadView } = useThread(threadId);
  const createThread = useCreateThread();
  const deleteThread = useDeleteThread();
  const confirmTools = useConfirmTools();
  const qc = useQueryClient();

  const busy = streaming || confirmTools.isPending || createThread.isPending;

  // Solo sincronizamos los mensajes desde la vista del hilo cuando CAMBIA la
  // selección (al abrir un hilo). Nunca después de un turno: la vista puede venir
  // cacheada SIN la última respuesta (se cargó con solo el mensaje del usuario) y
  // pisaría lo que trajo el stream — el síntoma "la respuesta aparece y desaparece".
  // El evento `done` del stream es la fuente de verdad del turno.
  const syncedThreadRef = useRef<string | null>(null);
  useEffect(() => {
    if (!threadId) {
      syncedThreadRef.current = null;
      return;
    }
    if (streaming) return;
    if (threadView && syncedThreadRef.current !== threadId) {
      setMessages(threadView.messages ?? []);
      setPending(threadView.pending ?? []);
      syncedThreadRef.current = threadId;
    }
  }, [threadId, threadView, streaming]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [
    messages,
    pending,
    busy,
    streamingText,
    streamingReasoning,
    liveHandoffs,
    workflowSteps,
    workflowActivity,
    workflowMessages,
  ]);

  const uploadOne = async (file: File) => {
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    const mime = inferMimeFromName(file);
    const kind = kindFromMime(mime);
    const previewUrl = kind === 'image' ? URL.createObjectURL(file) : undefined;
    setAttachments((a) => [
      ...a,
      { id, kind, filename: file.name, mime_type: mime, previewUrl, uploading: true },
    ]);
    try {
      const res = await sdk.admin.upload.create({ files: [file] });
      const f = res.files?.[0];
      if (!f?.url) throw new Error('sin url');
      setAttachments((a) =>
        a.map((x) => (x.id === id ? { ...x, url: f.url, file_id: f.id, uploading: false } : x)),
      );
    } catch {
      setAttachments((a) => a.map((x) => (x.id === id ? { ...x, uploading: false, error: true } : x)));
      toast.error(`No se pudo subir ${file.name}`);
    }
  };

  const onPickFiles = (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) void uploadOne(file);
  };

  const removeAttachment = (id: string) =>
    setAttachments((a) => {
      const found = a.find((x) => x.id === id);
      if (found?.previewUrl) URL.revokeObjectURL(found.previewUrl);
      return a.filter((x) => x.id !== id);
    });

  /** Paste de imágenes desde el portapapeles (screenshots) → se suben como adjunto. */
  const onComposerPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'));
    if (imgs.length > 0) {
      e.preventDefault();
      for (const f of imgs) void uploadOne(f);
    }
  };

  // Semilla desde Propuestas ("Preguntar en el chat"): pre-carga el composer con
  // el contexto de la propuesta para repreguntar. Se consume una sola vez.
  useEffect(() => {
    let seed: string | null = null;
    try {
      seed = sessionStorage.getItem('ai-assistant:chat-seed');
      if (seed) sessionStorage.removeItem('ai-assistant:chat-seed');
    } catch {
      /* ignore */
    }
    if (seed) {
      setInput(seed);
      setTimeout(() => composerRef.current?.focus(), 0);
    }
  }, []);

  const selectThread = (id: string | null) => {
    setThreadId(id);
    setMessages([]);
    setPending([]);
    setError(null);
    setWorkflowSteps([]);
    setWorkflowActivity({});
    setWorkflowMessages([]);
    setWorkflowArtifact(null);
    // Forzamos el re-sync desde la vista del hilo recién seleccionado.
    syncedThreadRef.current = null;
  };

  const onNewChat = () => selectThread(null);

  // ── Mención `@agente` en el composer ──────────────────────────────────────
  // Mención en edición (posición de la `@` + query) y opción resaltada del popup.
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  // Agente elegido del popup: queda como ETIQUETA removible en el composer (el
  // `@query` tipeado se saca del texto). Un solo destinatario por mensaje.
  const [taggedAgent, setTaggedAgent] = useState<Agent | null>(null);
  // Recalcula la mención desde el DOM (valor + caret reales del textarea): se
  // invoca en cada tipeo/click/movimiento de caret.
  const refreshMention = () => {
    const el = composerRef.current;
    if (!el) return;
    setMention(getMentionContext(el.value, el.selectionStart ?? el.value.length));
  };
  const mentionCandidates = useMemo(() => {
    if (!mention) return [];
    const q = normalizeMention(mention.query);
    return teamAgents.filter(
      (a) => !q || normalizeMention(a.name).includes(q) || normalizeMention(a.key).includes(q),
    );
  }, [mention, teamAgents]);
  useEffect(() => setMentionIdx(0), [mention?.query]);

  /**
   * Elige un agente del popup: saca el `@query` del texto y deja al agente como
   * etiqueta del composer (si ya había una, la reemplaza — un destinatario por vez).
   */
  const insertMention = (a: Agent) => {
    if (!mention) return;
    const el = composerRef.current;
    const caret = el?.selectionStart ?? input.length;
    const before = input.slice(0, mention.start);
    setTaggedAgent(a);
    setInput(before + input.slice(caret));
    setMention(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(before.length, before.length);
    });
  };

  /**
   * Agente citado con `@` en un texto (para mandar `agent_key` al server). Matchea
   * por nombre o key, sin tildes ni mayúsculas, priorizando el nombre más largo
   * (así "@Analista de Ventas" no se corta en un hipotético "@Analista").
   */
  const findMentionedAgent = (text: string): Agent | null => {
    const t = normalizeMention(text);
    const sorted = [...teamAgents].sort((a, b) => b.name.length - a.name.length);
    for (const a of sorted) {
      for (const needle of [`@${normalizeMention(a.name)}`, `@${normalizeMention(a.key)}`]) {
        const i = t.indexOf(needle);
        if (i >= 0 && (i === 0 || /\s/.test(t[i - 1]))) return a;
      }
    }
    return null;
  };
  // A quién va dirigido el mensaje en composición: la etiqueta elegida del popup,
  // o (fallback) una mención tipeada a mano que resuelva a un agente.
  const mentionTarget = useMemo(
    () => taggedAgent ?? findMentionedAgent(input),
    [taggedAgent, input, teamAgents],
  );

  const prompt = usePrompt();
  const onDelete = async (id: string, title?: string) => {
    const confirmed = await prompt({
      title: 'Eliminar chat',
      description: `¿Eliminar el chat${title ? ` "${title}"` : ''}? Esta acción no se puede deshacer.`,
      variant: 'danger',
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;
    await deleteThread.mutateAsync(id);
    if (id === threadId) selectThread(null);
  };

  const doSend = async (text: string, opts?: { display?: string }) => {
    const trimmed = text.trim();
    // Mención `@agente`: la etiqueta del composer (o una mención tipeada a mano)
    // se manda como `agent_key` para que ese agente tome el turno. Con etiqueta,
    // el texto lleva `@Nombre` adelante para que la cita quede visible en el hilo
    // (nunca en bloques crudos de campaña, que el server parsea tal cual).
    const mentionAgent = taggedAgent ?? findMentionedAgent(trimmed);
    const withTag = taggedAgent && !opts?.display && trimmed;
    const sendText = withTag ? `@${taggedAgent.name} ${trimmed}` : trimmed;
    // En bloques de campaña, lo que se manda al server es el <campaign_step> crudo,
    // pero la burbuja optimista muestra un resumen legible.
    const displayContent = opts?.display ?? sendText;
    const ready = attachments.filter((a) => a.url && !a.uploading && !a.error);
    if ((!trimmed && ready.length === 0) || busy) return;
    if (attachments.some((a) => a.uploading)) return; // esperá a que terminen de subir
    setInput('');
    setTaggedAgent(null);
    setError(null);

    // Lo que se manda al server (URL ya subida) vs. lo que se muestra al toque
    // (object URL local para que la imagen aparezca sin esperar el round-trip).
    const sendAttachments = ready.map((a) => ({
      kind: a.kind,
      url: a.url as string,
      file_id: a.file_id ?? null,
      filename: a.filename,
      mime_type: a.mime_type,
    }));
    const optimisticAttachments: ChatAttachment[] = ready.map((a) => ({
      kind: a.kind,
      url: a.previewUrl ?? (a.url as string),
      file_id: a.file_id ?? null,
      filename: a.filename,
      mime_type: a.mime_type,
    }));
    setAttachments([]);

    let id = threadId;
    if (!id) {
      const { thread } = await createThread.mutateAsync();
      id = thread.id;
      setThreadId(id);
    }
    // A partir de acá el turno es la fuente de verdad de este hilo: evitamos que el
    // efecto de sincronización pise la respuesta con una vista cacheada sin ella.
    syncedThreadRef.current = id;

    setMessages((m) => [
      ...m,
      {
        kind: 'message',
        id: `tmp-${Date.now()}`,
        role: 'user',
        content: displayContent,
        status: 'complete',
        attachments: optimisticAttachments.length > 0 ? optimisticAttachments : undefined,
      },
    ]);

    setStreaming(true);
    setStreamingText('');
    setStreamingReasoning('');
    setActivity(null);
    // Si hubo mención, el avatar "pensando" ya arranca con el agente citado (el
    // evento `step` lo confirma apenas empieza el turno).
    setLiveAgentKey(mentionAgent?.key ?? null);
    setLiveHandoffs([]);
    setWorkflowSteps([]);
    setWorkflowActivity({});
    setWorkflowMessages([]);
    setWorkflowArtifact(null);
    try {
      const period = computePeriod();
      await streamMessage(
        {
          threadId: id,
          text: sendText,
          model,
          skill: 'auto',
          period,
          agent_key: mentionAgent?.key,
          attachments: sendAttachments.length > 0 ? sendAttachments : undefined,
        },
        (ev) => {
        switch (ev.type) {
          case 'token':
            setStreamingText((t) => t + ev.text);
            break;
          case 'reasoning':
            setStreamingReasoning((t) => t + ev.text);
            break;
          case 'step':
            // Nueva vuelta del modelo: limpiamos preámbulo/razonamiento de la
            // anterior y registramos qué agente toma el control (su avatar).
            setStreamingText('');
            setStreamingReasoning('');
            setActivity(null);
            setLiveAgentKey(ev.agent);
            break;
          case 'tool_call':
            setStreamingText('');
            setStreamingReasoning('');
            // Durante un workflow el checklist ya muestra el progreso; el nombre crudo
            // "start_workflow" no le dice nada al usuario.
            setActivity(ev.name === 'start_workflow' ? 'Coordinando al equipo…' : `Consultando ${ev.name}…`);
            break;
          case 'tool_result':
            setActivity(null);
            break;
          case 'handoff':
            setActivity(`Derivando a ${getAgent(ev.target)?.name ?? ev.target}…`);
            setLiveHandoffs((h) => [...h, { from: ev.from, target: ev.target, reason: ev.reason }]);
            break;
          case 'workflow_started':
            setWorkflowSteps(ev.checklist ?? []);
            break;
          case 'workflow_step':
            // Mientras corre el workflow, la barra de equipo resalta al SUBAGENTE
            // del paso en curso (no al Orquestador, que está esperando el resultado).
            if (ev.status === 'in_progress') setLiveAgentKey(ev.agent_key);
            setWorkflowSteps((steps) => {
              const item: WorkflowChecklistItem = {
                key: ev.step_key,
                agent_key: ev.agent_key,
                label: ev.label,
                status: ev.status,
                result_summary: ev.result_summary,
              };
              const i = steps.findIndex((s) => s.key === ev.step_key);
              if (i < 0) return [...steps, item];
              const next = [...steps];
              next[i] = { ...next[i], ...item };
              return next;
            });
            break;
          case 'workflow_done':
            // Al cerrar, surfaceamos el borrador (link de preview) y los faltantes de
            // forma fiable, sin depender de que el orquestador los repita en su texto.
            if (ev.status === 'completed' && (ev.artifact || (ev.unmatched && ev.unmatched.length))) {
              setWorkflowArtifact({
                preview_url: ev.artifact?.preview_url ?? null,
                post_id: ev.artifact?.post_id ?? null,
                unmatched: ev.unmatched ?? [],
              });
            }
            break;
          case 'workflow_message':
            setWorkflowMessages((m) => [...m, { agent_key: ev.agent_key, text: ev.text }]);
            break;
          case 'workflow_activity': {
            // Actividad real del subagente del paso (búsquedas, fuentes, tools): la
            // acumulamos por step_key para la Cadena de pensamiento. El razonamiento
            // (si llegara) se coalesce en una sola fila por paso en vez de una por token.
            setWorkflowActivity((prev) => {
              const list = prev[ev.step_key] ?? [];
              if (ev.kind === 'reasoning') {
                const i = list.findIndex((a) => a.kind === 'reasoning');
                if (i >= 0) {
                  const next = [...list];
                  next[i] = { ...next[i], label: (next[i].label + ev.label).slice(-2000) };
                  return { ...prev, [ev.step_key]: next };
                }
              }
              const item: WorkflowActivity = {
                id: `${ev.step_key}-${list.length}-${ev.kind}`,
                step_key: ev.step_key,
                agent_key: ev.agent_key,
                kind: ev.kind,
                label: ev.label,
                detail: ev.detail,
                url: ev.url,
              };
              return { ...prev, [ev.step_key]: [...list, item] };
            });
            break;
          }
          case 'done':
            setMessages(ev.messages ?? []);
            setPending(ev.pending ?? []);
            break;
          case 'error':
            setError(ev.message);
            break;
        }
      });
      qc.invalidateQueries({ queryKey: ['ai-threads'] });
      // Refrescamos la vista del hilo en cache (ya con la respuesta), para que al
      // volver a abrirlo más tarde muestre el turno completo. No pisa lo actual:
      // el efecto de sync está gateado por `syncedThreadRef`.
      qc.invalidateQueries({ queryKey: ['ai-thread', id] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStreaming(false);
      setStreamingText('');
      setStreamingReasoning('');
      setActivity(null);
      setLiveAgentKey(null);
      setLiveHandoffs([]);
    }
  };

  const onResolve = async (approved: boolean) => {
    if (!threadId) return;
    setError(null);
    const decisions = pending.map((p) => ({ tool_call_id: p.tool_call_id, approved }));
    try {
      const res = await confirmTools.mutateAsync({ threadId, decisions, model });
      setMessages(res.messages ?? []);
      setPending(res.pending ?? []);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const suggestions = SUGGESTIONS_BY_SKILL.auto ?? [];
  const isEmpty = messages.length === 0 && pending.length === 0;
  // Con la lista colapsada el contenido se ensancha para aprovechar el ancho.
  const contentMax = sidebarOpen ? 'max-w-3xl' : 'max-w-5xl';

  // Último mensaje de texto del asistente (saltea actividad/handoffs): de ahí salen
  // las opciones clickeables y el agente al que se le atribuye una acción pendiente.
  const lastAssistantMsg = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.kind === 'message' && m.role === 'assistant') return m as Message;
    }
    return null;
  }, [messages]);
  const lastOptions = lastAssistantMsg ? parseAskOptions(lastAssistantMsg.content) : null;
  // Bloque interactivo del wizard de campaña en el último mensaje del asistente.
  const lastCampaignBlock = lastAssistantMsg ? parseCampaignBlock(lastAssistantMsg.content) : null;
  // Agente que pide la confirmación: el activo en vivo, o el del último mensaje.
  const pendingAgent = getAgent(liveAgentKey ?? lastAssistantMsg?.agent_key);
  // Quién se resalta en la barra de equipo: el agente en vivo del turno; si no
  // hay turno corriendo, el destinatario del mensaje en composición (etiqueta o
  // mención tipeada); si no, el del último mensaje del asistente.
  const activeKey =
    liveAgentKey ?? (!streaming ? mentionTarget?.key ?? null : null) ?? lastAssistantMsg?.agent_key ?? null;
  const workflowInlineBeforeId = !streaming && workflowSteps.length > 0 ? lastAssistantMsg?.id ?? null : null;

  return (
    <div className="flex h-[calc(100vh-110px)] min-h-[520px] gap-4">
      {/* Sidebar de hilos (colapsable: oculto → el chat usa todo el ancho) */}
      {sidebarOpen ? (
        <div className="flex w-60 shrink-0 flex-col rounded-xl border border-ui-border-base bg-ui-bg-subtle">
        <div className="p-2">
          <button
            type="button"
            onClick={onNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-ui-border-base bg-ui-bg-base px-3 py-2 txt-compact-small-plus text-ui-fg-base transition-colors hover:bg-ui-bg-base-hover"
          >
            <Plus /> Nuevo chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {threads.length === 0 ? (
            <p className="p-2 txt-small text-ui-fg-muted">Sin hilos todavía.</p>
          ) : (
            threads.map((t) => (
              <div
                key={t.id}
                className={`group mb-1 flex items-center justify-between gap-1 rounded-lg px-2 py-2 transition-colors ${
                  t.id === threadId
                    ? 'bg-ui-bg-base shadow-elevation-card-rest'
                    : 'hover:bg-ui-bg-base'
                }`}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left txt-compact-small text-ui-fg-base"
                  onClick={() => selectThread(t.id)}
                  title={t.title}
                >
                  {t.title}
                </button>
                <span className="opacity-0 transition-opacity group-hover:opacity-100">
                  <IconButton size="2xsmall" variant="transparent" onClick={() => onDelete(t.id, t.title)}>
                    <Trash />
                  </IconButton>
                </span>
              </div>
            ))
          )}
        </div>
        </div>
      ) : null}

      {/* Superficie de chat */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-ui-border-base bg-ui-bg-subtle">
        {/* Progreso del workflow: card FLOTANTE aparte (glance de estado en vivo).
            Solo el checklist; la cadena de pensamiento va en el hilo como un mensaje. */}
        {streaming && workflowSteps.length > 0 ? (
          <div className="pointer-events-auto absolute right-3 top-14 z-20 flex max-h-[calc(100%-5rem)] w-80 max-w-[85%] flex-col gap-2 overflow-y-auto">
            <WorkflowChecklist steps={workflowSteps} getAgent={getAgent} />
          </div>
        ) : null}
        <div className="flex items-center gap-2 border-b border-ui-border-base px-3 py-2">
          <IconButton
            size="small"
            variant="transparent"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? 'Ocultar hilos' : 'Mostrar hilos'}
          >
            <PanelToggle />
          </IconButton>
          <TeamBar agents={teamAgents} activeKey={activeKey} working={busy} />
        </div>
        <div className="flex-1 overflow-y-auto">
          {isEmpty ? (
            <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center gap-5 px-4 py-10 text-center">
              <AgentAvatarGroup agents={teamAgents} />
              <p className="txt-large-plus text-ui-fg-base">{greeting}</p>
              <div className="grid w-full gap-2 sm:grid-cols-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="rounded-xl border border-ui-border-base bg-ui-bg-base px-3 py-2.5 text-left txt-small text-ui-fg-base transition-colors hover:bg-ui-bg-base-hover"
                    onClick={() => doSend(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className={`mx-auto flex ${contentMax} flex-col gap-4 px-4 py-6`}>
              {messages.map((item, i) => {
                if (item.kind === 'activity') {
                  return <ActivityLine key={item.id} label={item.label} ok={item.ok} />;
                }
                if (item.kind === 'handoff') {
                  return (
                    <HandoffCard
                      key={item.id}
                      from={getAgent(item.from)}
                      to={getAgent(item.target)}
                      reason={item.reason}
                    />
                  );
                }
                if (item.role === 'user') {
                  const atts = item.attachments ?? [];
                  const imgs = atts.filter((a) => a.kind === 'image');
                  const docs = atts.filter((a) => a.kind === 'document');
                  return (
                    <div key={item.id} className="flex justify-end">
                      <div className="flex max-w-[80%] flex-col items-end gap-2">
                        {imgs.length > 0 ? (
                          <div className="flex flex-wrap justify-end gap-2">
                            {imgs.map((a, idx) => (
                              <a
                                key={idx}
                                href={a.url}
                                target="_blank"
                                rel="noreferrer"
                                title={a.filename}
                                className="block overflow-hidden rounded-xl border border-ui-border-base"
                              >
                                <img src={a.url} alt={a.filename} className="max-h-48 max-w-[220px] object-cover" />
                              </a>
                            ))}
                          </div>
                        ) : null}
                        {docs.map((a, idx) => (
                          <a
                            key={idx}
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            title={a.filename}
                            className="flex items-center gap-2 rounded-xl border border-ui-border-base bg-ui-bg-base px-3 py-2 text-ui-fg-subtle transition-colors hover:bg-ui-bg-base-hover"
                          >
                            <DocIcon />
                            <span className="max-w-[200px] truncate txt-small">{a.filename}</span>
                          </a>
                        ))}
                        {item.content ? (
                          <div className="rounded-2xl rounded-br-md border border-ui-border-base bg-ui-bg-base px-4 py-2.5 text-sm text-ui-fg-base shadow-elevation-card-rest">
                            <p className="whitespace-pre-wrap">
                              <UserText content={item.content} agents={teamAgents} />
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                }
                // Mensaje del asistente: agrupamos consecutivos del mismo agente.
                const prev = messages[i - 1];
                const grouped =
                  prev &&
                  prev.kind === 'message' &&
                  prev.role === 'assistant' &&
                  prev.agent_key === item.agent_key;
                const workflowBeforeThis = workflowInlineBeforeId === item.id;
                return (
                  <Fragment key={item.id}>
                    {workflowBeforeThis ? (
                      <>
                        <WorkflowChainMessage
                          steps={workflowSteps}
                          activityByStep={workflowActivity}
                          getAgent={getAgent}
                        />
                        {workflowMessages.map((m, idx) => (
                          <AssistantMessage
                            key={`wf-msg-final-${idx}`}
                            content={m.text}
                            agent={getAgent(m.agent_key)}
                          />
                        ))}
                      </>
                    ) : null}
                    <AssistantMessage
                      content={item.content}
                      agent={getAgent(item.agent_key)}
                      showHeader={!grouped}
                      copyable
                    />
                  </Fragment>
                );
              })}
              {/* Bloque interactivo del wizard de campaña (formulario/selector/preview).
                  Se renderiza fuera de AssistantMessage para tener doSend en alcance. */}
              {pending.length === 0 && lastCampaignBlock ? (
                <CampaignBlockView
                  block={lastCampaignBlock}
                  threadId={threadId}
                  busy={busy}
                  onSubmit={(raw, display) => doSend(raw, { display })}
                />
              ) : null}
              {/* Opciones propuestas por el asistente: elegir una con un clic, o
                  "Otra…" para escribir libre (el textarea siempre está). */}
              {!busy && pending.length === 0 && !lastCampaignBlock && lastOptions ? (
                <div className="flex flex-wrap gap-2 pl-10">
                  {lastOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => doSend(opt)}
                      className="rounded-xl border border-ui-border-base bg-ui-bg-base px-3 py-2 text-left txt-small text-ui-fg-base transition-colors hover:bg-ui-bg-base-hover"
                    >
                      {opt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => composerRef.current?.focus()}
                    className="rounded-xl border border-dashed border-ui-border-strong bg-transparent px-3 py-2 txt-small text-ui-fg-subtle transition-colors hover:bg-ui-bg-base"
                  >
                    Otra…
                  </button>
                </div>
              ) : null}
              {pending.length > 0 ? (
                <PendingApproval pending={pending} agent={pendingAgent} onResolve={onResolve} busy={busy} />
              ) : null}
              {/* Progreso y cadena de pensamiento del workflow dentro del hilo. */}
              {workflowSteps.length > 0 && (streaming || !workflowInlineBeforeId) ? (
                <WorkflowChainMessage
                  steps={workflowSteps}
                  activityByStep={workflowActivity}
                  getAgent={getAgent}
                />
              ) : null}
              {/* Voz de cada subagente del workflow, en vivo, como chat. */}
              {streaming || !workflowInlineBeforeId ? workflowMessages.map((m, idx) => (
                <AssistantMessage key={`wf-msg-${idx}`} content={m.text} agent={getAgent(m.agent_key)} />
              )) : null}
              {/* Card persistente al terminar el workflow: link al preview del borrador,
                  edición en Blog y aviso de ingredientes sin producto (con acción). */}
              {workflowArtifact ? (
                <div className="ml-10 flex flex-col gap-2 rounded-xl border border-ui-border-base bg-ui-bg-base p-3 shadow-elevation-card-rest">
                  <p className="txt-compact-small-plus text-ui-fg-base">Borrador listo</p>
                  {workflowArtifact.unmatched && workflowArtifact.unmatched.length > 0 ? (
                    <p className="txt-small text-amber-700">
                      ⚠ Sin productos para: {workflowArtifact.unmatched.join(', ')}.
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {workflowArtifact.preview_url ? (
                      <a
                        href={workflowArtifact.preview_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-ui-fg-base px-3 py-1.5 txt-compact-small text-ui-bg-base"
                      >
                        Ver preview
                      </a>
                    ) : null}
                    {workflowArtifact.post_id ? (
                      <a
                        href={`/app/blog/articles/${workflowArtifact.post_id}`}
                        className="rounded-lg border border-ui-border-base bg-ui-bg-base px-3 py-1.5 txt-compact-small text-ui-fg-base transition-colors hover:bg-ui-bg-base-hover"
                      >
                        Editar en Blog
                      </a>
                    ) : null}
                    {workflowArtifact.unmatched && workflowArtifact.unmatched.length > 0 ? (
                      <button
                        type="button"
                        onClick={() =>
                          doSend(
                            `Asociá al post productos del catálogo para estos ingredientes que quedaron sin producto: ${workflowArtifact.unmatched?.join(
                              ', ',
                            )}. No borres los productos ya vinculados.`,
                          )
                        }
                        className="rounded-lg border border-dashed border-ui-border-strong bg-transparent px-3 py-1.5 txt-compact-small text-ui-fg-subtle transition-colors hover:bg-ui-bg-base"
                      >
                        Buscar y asociar los faltantes
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {/* Derivaciones del turno en vivo: el equipo pasándose el trabajo. */}
              {streaming
                ? liveHandoffs.map((h, idx) => (
                    <HandoffCard
                      key={`live-handoff-${idx}`}
                      from={getAgent(h.from)}
                      to={getAgent(h.target)}
                      reason={h.reason}
                    />
                  ))
                : null}
              {/* Razonamiento en vivo (antes de que empiece la respuesta). */}
              {streaming && streamingReasoning && !streamingText ? (
                <ReasoningPanel text={streamingReasoning} agent={liveAgent} />
              ) : null}
              {/* Respuesta en vivo: texto que va llegando por el stream. */}
              {streaming && streamingText ? (
                <AssistantMessage content={streamingText} agent={liveAgent} />
              ) : null}
              {/* Indicador de trabajo: actividad de tool, o puntos suspensivos. */}
              {busy && !streamingText && !streamingReasoning ? (
                <div className="flex items-center gap-3">
                  {liveAgent ? <AgentAvatar agent={liveAgent} size={28} /> : <Avatar />}
                  {activity ? (
                    <span className="txt-small text-ui-fg-subtle">{activity}</span>
                  ) : (
                    <ThinkingDots />
                  )}
                </div>
              ) : null}
              {error ? (
                <div className="flex gap-3">
                  <Avatar />
                  <div className="min-w-0 flex-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                    <p className="txt-compact-small-plus text-red-800">No se pudo completar la consulta</p>
                    <p className="txt-small break-words text-red-700">{error}</p>
                  </div>
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Composer estilo AI Elements: card con textarea + toolbar */}
        <div className="px-4 pb-4">
          <div className={`relative mx-auto ${contentMax} rounded-2xl border border-ui-border-base bg-ui-bg-base p-2 shadow-elevation-card-rest`}>
            {/* Popup de mención @agente: aparece sobre el composer mientras se tipea. */}
            {mention && mentionCandidates.length > 0 ? (
              <div className="absolute bottom-full left-2 z-30 mb-2 w-72 overflow-hidden rounded-xl border border-ui-border-base bg-ui-bg-base shadow-elevation-card-hover">
                <p className="px-3 pb-1 pt-2 txt-small text-ui-fg-muted">Dirigir a un agente</p>
                <div className="max-h-64 overflow-y-auto pb-1">
                  {mentionCandidates.map((a, i) => (
                    <button
                      key={a.id}
                      type="button"
                      // onMouseDown (no onClick) para ganarle al blur del textarea.
                      onMouseDown={(e) => {
                        e.preventDefault();
                        insertMention(a);
                      }}
                      onMouseEnter={() => setMentionIdx(i)}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                        i === mentionIdx ? 'bg-ui-bg-base-hover' : ''
                      }`}
                    >
                      <AgentAvatar agent={a} size={24} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate txt-compact-small-plus text-ui-fg-base">
                          {a.name}
                        </span>
                        {a.description ? (
                          <span className="block truncate txt-small text-ui-fg-subtle">
                            {a.description}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {attachments.length > 0 ? (
              <div className="flex flex-wrap gap-2 px-1 pb-2">
                {attachments.map((a) => (
                  <div
                    key={a.id}
                    title={a.filename}
                    className={`flex items-center gap-2 rounded-lg border bg-ui-bg-subtle p-1 pr-2 ${
                      a.error ? 'border-red-300' : 'border-ui-border-base'
                    }`}
                  >
                    {a.kind === 'image' && a.previewUrl ? (
                      <img src={a.previewUrl} alt={a.filename} className="h-9 w-9 rounded object-cover" />
                    ) : (
                      <span className="grid h-9 w-9 place-items-center rounded bg-ui-bg-base text-ui-fg-subtle">
                        <DocIcon />
                      </span>
                    )}
                    <span className="max-w-[140px] truncate txt-small text-ui-fg-subtle">{a.filename}</span>
                    {a.uploading ? (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-ui-border-base border-t-ui-fg-base" />
                    ) : null}
                    {a.error ? <span className="txt-small text-red-600">error</span> : null}
                    <button
                      type="button"
                      onClick={() => removeAttachment(a.id)}
                      aria-label={`Quitar ${a.filename}`}
                      className="grid h-5 w-5 place-items-center rounded-full text-ui-fg-muted transition-colors hover:bg-ui-bg-base-hover hover:text-ui-fg-base"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            {/* Etiqueta de mención: el agente citado, removible (× o Backspace al inicio). */}
            {taggedAgent ? (
              <div className="flex flex-wrap items-center gap-2 px-1 pb-1">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-ui-border-base bg-ui-bg-subtle py-0.5 pl-1 pr-1.5">
                  <AgentAvatar agent={taggedAgent} size={18} />
                  <span className="txt-compact-small-plus text-ui-fg-base">@{taggedAgent.name}</span>
                  <button
                    type="button"
                    onClick={() => setTaggedAgent(null)}
                    aria-label={`Quitar mención a ${taggedAgent.name}`}
                    className="grid h-5 w-5 place-items-center rounded-full text-ui-fg-muted transition-colors hover:bg-ui-bg-base-hover hover:text-ui-fg-base"
                  >
                    <XMarkMini />
                  </button>
                </span>
              </div>
            ) : null}
            <textarea
              ref={composerRef}
              className="max-h-40 w-full resize-none bg-transparent px-2 py-2 text-sm text-ui-fg-base outline-none placeholder:text-ui-fg-muted"
              placeholder="Escribí tu pregunta…  (@ para citar a un agente, Enter para enviar)"
              value={input}
              rows={2}
              onChange={(e) => {
                setInput(e.target.value);
                refreshMention();
              }}
              onPaste={onComposerPaste}
              onKeyUp={(e) => {
                // Movimientos de caret (flechas/Home/End) también re-evalúan la mención.
                if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) refreshMention();
              }}
              onClick={refreshMention}
              onBlur={() => setMention(null)}
              onKeyDown={(e) => {
                // Con el popup de mención abierto, el teclado navega/elige ahí.
                if (mention && mentionCandidates.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setMentionIdx((i) => (i + 1) % mentionCandidates.length);
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setMentionIdx(
                      (i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length,
                    );
                    return;
                  }
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    insertMention(mentionCandidates[mentionIdx] ?? mentionCandidates[0]);
                    return;
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setMention(null);
                    return;
                  }
                }
                // Backspace con el caret al inicio y sin selección: quita la etiqueta.
                if (
                  e.key === 'Backspace' &&
                  taggedAgent &&
                  e.currentTarget.selectionStart === 0 &&
                  e.currentTarget.selectionEnd === 0
                ) {
                  e.preventDefault();
                  setTaggedAgent(null);
                  return;
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  doSend(input);
                }
              }}
            />
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ATTACH_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  onPickFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <Tooltip content="Adjuntar imágenes o documentos (PDF, TXT, MD)">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Adjuntar archivo"
                  className="grid h-9 w-9 place-items-center rounded-full border border-ui-border-base text-ui-fg-subtle transition-colors hover:bg-ui-bg-base-hover hover:text-ui-fg-base"
                >
                  <Paperclip />
                </button>
              </Tooltip>
              <div className="w-[140px]">
                <Select size="small" value={model} onValueChange={setModel}>
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content className="z-[60]">
                    {MODEL_OPTIONS.map((o) => (
                      <Select.Item key={o.id} value={o.id}>
                        {o.name}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
              <div className="w-[180px]">
                <Select
                  size="small"
                  value={periodPreset}
                  onValueChange={(v) => setPeriodPreset(v as PeriodPreset)}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content className="z-[60]">
                    {PERIOD_OPTIONS.map((o) => (
                      <Select.Item key={o.id} value={o.id}>
                        {o.label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
              {periodPreset === 'custom' ? (
                <div className="flex items-center gap-1">
                  <DatePicker value={customFrom} onChange={setCustomFrom} />
                  <span className="text-ui-fg-muted">→</span>
                  <DatePicker value={customTo} onChange={setCustomTo} />
                </div>
              ) : null}
              {/* A quién va dirigido el mensaje cuando la mención quedó tipeada a mano
                  (sin elegir del popup); con etiqueta puesta el chip sería redundante. */}
              {!taggedAgent && mentionTarget ? (
                <div className="flex items-center gap-1.5 rounded-full border border-ui-border-base bg-ui-bg-subtle px-2 py-1">
                  <AgentAvatar agent={mentionTarget} size={16} />
                  <span className="txt-small text-ui-fg-subtle">
                    Dirigido a <span className="text-ui-fg-base">{mentionTarget.name}</span>
                  </span>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => doSend(input)}
                disabled={
                  (!input.trim() && attachments.length === 0) ||
                  busy ||
                  attachments.some((a) => a.uploading)
                }
                aria-label="Enviar"
                className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-ui-fg-base text-ui-bg-base transition-opacity disabled:opacity-40"
              >
                <ArrowUp />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
