import { Badge, Button, Container, Heading, Input, Label, Prompt, Switch, Text, toast } from '@medusajs/ui';
import { useEffect, useState } from 'react';

import { useKapsoBotSwitch, useUpdateKapsoBotSwitch } from '../../../hooks/api/kapso';

/**
 * WhatsApp → Ajustes → EL BOT CONTESTA.
 *
 * Va primera de todas porque es la palanca más fuerte de la pantalla: apagada, nada
 * de lo que está más abajo cambia una sola conversación.
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 * Una tienda tiene UN número. Mientras el recorrido del bot se termina de armar, ese
 * número tiene que poder quedar entero para las personas del inbox — y hasta acá no
 * había forma: despublicar el recorrido devuelve el turno al router y al agente, que
 * siguen contestando.
 *
 * ── LAS DOS PALANCAS, Y POR QUÉ SE MUESTRAN JUNTAS ───────────────────────────
 * Apagar el bot NO despublica el recorrido: queda publicado y vuelve a atender en
 * cuanto se prenda. Despublicar el recorrido NO apaga el bot. Confundirlas es
 * exactamente el error que deja un número contestando solo cuando se creía apagado,
 * así que la card dice qué recorrido hay publicado en vez de dejarlo para otra
 * pantalla.
 *
 * ── LO QUE NO SE APAGA ───────────────────────────────────────────────────────
 * Sólo las RESPUESTAS a los mensajes entrantes. Las notificaciones que la tienda
 * manda (confirmación de pedido, seguimiento, carrito abandonado) salen igual: son
 * plantillas que dispara el negocio y se apagan una por una en Plantillas.
 */
export function BotSwitchCard() {
  const { data, isPending } = useKapsoBotSwitch();
  const [note, setNote] = useState('');
  const [confirmandoApagado, setConfirmandoApagado] = useState(false);

  const enabled = data?.bot_switch.enabled !== false;

  useEffect(() => {
    if (data?.bot_switch) setNote(data.bot_switch.note ?? '');
  }, [data?.bot_switch]);

  const save = useUpdateKapsoBotSwitch({
    onSuccess: (result) => {
      setConfirmandoApagado(false);
      toast.success(
        result.bot_switch.enabled
          ? 'El bot volvió a contestar.'
          : 'Bot apagado. Los mensajes que entren quedan en el inbox para que los lleve una persona.',
      );
    },
    onError: () => toast.error('No se pudo guardar.'),
  });

  /** Prender es inocuo y va derecho; apagar corta las respuestas y se pregunta. */
  const toggle = (next: boolean) => {
    if (!next) {
      setConfirmandoApagado(true);
      return;
    }
    save.mutate({ enabled: true, note: note.trim() || null });
  };

  return (
    <Container className="divide-y p-0">
      <div className="flex items-start justify-between gap-x-4 px-6 py-4">
        <div className="flex flex-col gap-y-1">
          <div className="flex items-center gap-x-2">
            <Heading level="h2">El bot contesta</Heading>
            <Badge size="2xsmall" color={enabled ? 'green' : 'orange'}>
              {enabled ? 'Encendido' : 'Apagado'}
            </Badge>
          </div>
          <Text size="small" className="text-ui-fg-subtle">
            Apagado, el número no contesta solo: todo mensaje que entre queda en el inbox
            para que lo lleve una persona. Tampoco despierta conversaciones con plazos
            vencidos. Las notificaciones de pedidos salen igual.
          </Text>
          {/* A QUIÉN alcanza. El ámbito lo decide la tienda activa del backoffice, que
              se elige en OTRA pantalla, así que acá no se deduce de nada visible. */}
          <Text size="xsmall" className="text-ui-fg-muted">
            {data?.site_id
              ? 'Aplica a esta tienda.'
              : 'Aplica a todas las tiendas: estás parado en el ámbito general.'}
          </Text>
        </div>
        <Switch
          checked={enabled}
          disabled={isPending || save.isPending}
          onCheckedChange={toggle}
          aria-label="El bot contesta"
        />
      </div>

      {/**
        * Qué recorrido queda publicado. Es la información que evita el error caro:
        * creer que apagar el bot despublicó el recorrido, o al revés.
        */}
      <div className="flex flex-col gap-y-1 px-6 py-4">
        <Text size="small" weight="plus">
          Recorrido publicado
        </Text>
        <Text size="small" className="text-ui-fg-subtle">
          {data?.active_flow
            ? `“${data.active_flow.name?.trim() || `Versión ${data.active_flow.version}`}” sigue publicado. ${
                enabled
                  ? 'Es el que lleva la conversación.'
                  : 'No atiende mientras el bot esté apagado, y vuelve a atender en cuanto lo prendas.'
              }`
            : 'No hay ninguno publicado. El bot contesta con el menú de siempre y el asistente.'}
        </Text>
      </div>

      <div className="flex flex-col gap-y-2 px-6 py-4">
        <Label size="small" htmlFor="wa-bot-switch-note">
          Nota para el equipo (opcional)
        </Label>
        <Input
          id="wa-bot-switch-note"
          value={note}
          placeholder="Ej: apagado hasta terminar el recorrido de compra"
          onChange={(e) => setNote(e.target.value)}
          maxLength={280}
        />
        <div className="flex justify-end">
          <Button
            size="small"
            variant="secondary"
            isLoading={save.isPending}
            disabled={isPending || (note.trim() || null) === (data?.bot_switch.note ?? null)}
            onClick={() => save.mutate({ enabled, note: note.trim() || null })}
          >
            Guardar la nota
          </Button>
        </div>
      </div>

      {/* Apagar el bot cambia lo que le pasa al cliente que escribe en el próximo
          minuto, y el síntoma —silencio— es indistinguible de una caída. Se pregunta
          y se dice qué queda pasando. */}
      <Prompt open={confirmandoApagado} onOpenChange={setConfirmandoApagado}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Apagar el bot</Prompt.Title>
            <Prompt.Description>
              El número deja de contestar solo. Los mensajes que entren se guardan y quedan
              en el inbox para que los lleve una persona. Las notificaciones de pedidos y
              las campañas siguen saliendo.
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel>Cancelar</Prompt.Cancel>
            <Prompt.Action onClick={() => save.mutate({ enabled: false, note: note.trim() || null })}>
              Apagar
            </Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </Container>
  );
}
