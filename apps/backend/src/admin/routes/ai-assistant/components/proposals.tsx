import { Badge, Button, Drawer, Heading, Text } from '@medusajs/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useProposals,
  useApproveProposal,
  useRejectProposal,
  useGenerateProposals,
  type Proposal,
} from '../hooks';
import { ExtensionVersion } from '../../../components/common/extension-version';

type BadgeColor = 'grey' | 'orange' | 'blue' | 'green' | 'red';

const STATUS: Record<Proposal['status'], { label: string; color: BadgeColor }> = {
  draft: { label: 'Borrador', color: 'grey' },
  pending: { label: 'Pendiente', color: 'orange' },
  approved: { label: 'Aprobada', color: 'blue' },
  rejected: { label: 'Rechazada', color: 'grey' },
  executed: { label: 'Ejecutada', color: 'green' },
  failed: { label: 'Falló', color: 'red' },
};

/**
 * Estado a mostrar. Una propuesta ASESORA (sin acciones) aprobada no ejecutó
 * nada, así que la mostramos como "Aceptada" (y no "Ejecutada") para no confundir
 * con una ejecución real. Cubre también las viejas marcadas "executed".
 */
function statusInfo(p: Proposal): { label: string; color: BadgeColor } {
  const noActions = !Array.isArray(p.proposed_actions) || p.proposed_actions.length === 0;
  if (noActions && (p.status === 'executed' || p.status === 'approved')) {
    return { label: 'Aceptada', color: 'blue' };
  }
  return STATUS[p.status] ?? STATUS.pending;
}

/** Detalle exhaustivo de una propuesta (va dentro del Drawer, no en el listado). */
const ProposalDetail = ({
  proposal,
  onResolved,
}: {
  proposal: Proposal;
  onResolved: () => void;
}) => {
  const approve = useApproveProposal();
  const reject = useRejectProposal();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const st = statusInfo(proposal);
  const actions = Array.isArray(proposal.proposed_actions) ? proposal.proposed_actions : [];
  const results = proposal.execution_result?.results ?? [];
  const noActions = actions.length === 0;
  // Qué pasó tras revisarla (para que el resultado de aprobar quede claro).
  const outcome =
    proposal.status === 'pending'
      ? null
      : proposal.status === 'rejected'
        ? 'Rechazaste esta propuesta.'
        : noActions
          ? 'La aceptaste. Es una propuesta asesora: no se ejecutó ninguna acción automática — implementala a mano.'
          : proposal.status === 'failed'
            ? 'Se intentaron ejecutar las acciones y al menos una falló (ver Resultado).'
            : 'Aprobada: se ejecutaron sus acciones (ver Resultado).';

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      onResolved();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Lleva la propuesta al Chat: deja el contexto en sessionStorage y navega; el
  // Chat lo lee al montar, pre-carga el composer y vos repreguntás sobre ella.
  const openInChat = () => {
    const labels = actions
      .map((a) => a.label ?? a.tool)
      .filter(Boolean)
      .join('; ');
    const seed = [
      `Sobre la propuesta «${proposal.title}»: ${proposal.summary}`,
      labels ? `Acción propuesta: ${labels}.` : '',
      '',
      'Mi pregunta: ',
    ]
      .filter(Boolean)
      .join('\n');
    try {
      sessionStorage.setItem('ai-assistant:chat-seed', seed);
    } catch {
      /* ignore */
    }
    navigate('/ai-assistant/chat');
  };

  return (
    <>
      <Drawer.Header>
        <Drawer.Title>{proposal.title}</Drawer.Title>
      </Drawer.Header>
      <Drawer.Body className="overflow-y-auto">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge size="2xsmall" color={st.color}>
              {st.label}
            </Badge>
            <code className="txt-small text-ui-fg-muted">{proposal.agent_key}</code>
          </div>

          {error ? <Text className="txt-small text-red-600">{error}</Text> : null}

          {outcome ? (
            <div className="rounded-md border border-ui-border-base bg-ui-bg-subtle px-3 py-2 txt-small text-ui-fg-subtle">
              {outcome}
            </div>
          ) : null}

          <p className="text-sm text-ui-fg-base">{proposal.summary}</p>

          {proposal.rationale ? (
            <div>
              <p className="txt-compact-small-plus text-ui-fg-base">Análisis</p>
              <p className="mt-1 whitespace-pre-wrap txt-small text-ui-fg-subtle">{proposal.rationale}</p>
            </div>
          ) : null}

          {actions.length > 0 ? (
            <div>
              <p className="txt-compact-small-plus text-ui-fg-base">Acciones propuestas</p>
              <ul className="mt-1 flex flex-col gap-2">
                {actions.map((a, i) => (
                  <li
                    key={i}
                    className="flex flex-col gap-1 rounded-md border border-ui-border-base bg-ui-bg-subtle px-3 py-2"
                  >
                    <p className="txt-small text-ui-fg-base">{a.label ?? a.tool}</p>
                    {a.label ? <code className="txt-small text-ui-fg-muted">{a.tool}</code> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="txt-small text-ui-fg-muted">
              Propuesta asesora (sin acciones automáticas; ejecutala a mano).
            </p>
          )}

          {results.length > 0 ? (
            <div className="rounded-md border border-ui-border-base p-2">
              <p className="txt-compact-small-plus text-ui-fg-base">Resultado</p>
              {results.map((r, i) => (
                <p key={i} className={`txt-small ${r.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                  {r.ok ? '✓' : '✗'} {r.tool}: {r.text.slice(0, 400)}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </Drawer.Body>
      <Drawer.Footer>
        <Button size="small" variant="secondary" onClick={openInChat}>
          Preguntar en el chat
        </Button>
        {proposal.status === 'pending' ? (
          <>
            <Button
              size="small"
              variant="secondary"
              onClick={() => run(() => reject.mutateAsync(proposal.id))}
              isLoading={reject.isPending}
            >
              Rechazar
            </Button>
            <Button
              size="small"
              onClick={() => run(() => approve.mutateAsync(proposal.id))}
              isLoading={approve.isPending}
            >
              Aprobar{actions.length > 0 ? ' y ejecutar' : ''}
            </Button>
          </>
        ) : null}
      </Drawer.Footer>
    </>
  );
};

export const Proposals = () => {
  const { data, isLoading } = useProposals();
  const generate = useGenerateProposals();
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Proposal | null>(null);
  const proposals = data?.proposals ?? [];

  const onGenerate = async () => {
    setError(null);
    try {
      await generate.mutateAsync();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4">
        <div className="flex items-center gap-x-2">
          <Heading level="h1">Propuestas</Heading>
          <ExtensionVersion extension="ai-assistant" />
        </div>
        <Button size="small" onClick={onGenerate} isLoading={generate.isPending}>
          Generar propuestas
        </Button>
      </div>

      <div className="flex flex-col gap-4 px-6 pb-6">
      {error ? <Text className="txt-small text-red-600">{error}</Text> : null}

      {isLoading ? (
        <Text className="text-ui-fg-subtle">Cargando propuestas…</Text>
      ) : proposals.length === 0 ? (
        <Text className="text-ui-fg-subtle txt-small">
          No hay propuestas todavía. Generá propuestas a mano o esperá a que corra el análisis
          automático.
        </Text>
      ) : (
        <div className="flex flex-col gap-2">
          {proposals.map((p) => {
            const st = statusInfo(p);
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-lg border border-ui-border-base bg-ui-bg-base px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate txt-compact-small-plus text-ui-fg-base">{p.title}</p>
                    <Badge size="2xsmall" color={st.color}>
                      {st.label}
                    </Badge>
                    <code className="txt-small text-ui-fg-muted">{p.agent_key}</code>
                  </div>
                </div>
                <Button size="small" variant="secondary" className="shrink-0" onClick={() => setDetail(p)}>
                  Ver detalle
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Drawer open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
        <Drawer.Content className="z-[50]">
          {detail ? <ProposalDetail proposal={detail} onResolved={() => setDetail(null)} /> : null}
        </Drawer.Content>
      </Drawer>
      </div>
    </>
  );
};
