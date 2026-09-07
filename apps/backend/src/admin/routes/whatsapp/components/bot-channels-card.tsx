import { Badge, Button, Checkbox, Container, Heading, Label, Text, toast } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import {
  useKapsoBotChannels,
  useUpdateKapsoBotChannels,
} from '../../../hooks/api/kapso';

/**
 * WhatsApp → Ajustes → Canales que atiende el bot.
 *
 * Reemplaza a la env `WHATSAPP_SALES_CHANNEL_ID`, que tenía dos problemas:
 * cambiarla exigía un deploy y no se veía desde el backoffice. El síntoma real
 * fue un bot ofreciendo parrilleros y termotanques porque apuntaba al canal
 * equivocado, sin que nada en la UI lo delatara — de ahí que esta card muestre
 * SIEMPRE con qué catálogo está trabajando el bot ahora mismo.
 *
 * La búsqueda abarca todos los canales elegidos; un PEDIDO pertenece a uno solo,
 * y es el primero de la lista (ver `resolveOrderSalesChannel`).
 */
export function BotChannelsCard() {
  const { data, isPending } = useKapsoBotChannels();
  const [selected, setSelected] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  // Se hidrata desde el server hasta que el operador toca algo (si no, cada
  // refetch le pisaría la selección a medio hacer).
  useEffect(() => {
    if (!dirty && data?.bot_channels) {
      setSelected(data.bot_channels.sales_channel_ids);
    }
  }, [data, dirty]);

  const save = useUpdateKapsoBotChannels({
    onSuccess: (result) => {
      setDirty(false);
      if (result.dropped?.length) {
        toast.warning('Guardado, pero se descartaron canales que ya no existen.');
        return;
      }
      toast.success(
        result.configured
          ? 'Listo. El bot ya trabaja con esos canales.'
          : 'Sin canales elegidos: el bot vuelve al canal por defecto.',
      );
    },
    onError: () => toast.error('No se pudo guardar la selección.'),
  });

  const channels = data?.channels ?? [];
  const toggle = (id: string) => {
    setDirty(true);
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  /** Nombre del canal, o el id si es uno que ya no existe. */
  const nameOf = (id: string) => channels.find((c) => c.id === id)?.name ?? id;

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Catálogo que atiende el bot</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            De qué canales de venta puede ofrecer productos el asistente de WhatsApp.
          </Text>
        </div>
        {data ? (
          <Badge size="small" color={data.configured ? 'green' : 'orange'}>
            {data.configured ? `${selected.length} elegido(s)` : 'sin configurar'}
          </Badge>
        ) : null}
      </div>

      {/* Qué está usando el bot AHORA. Es la información que faltaba: sin esto no
          había forma de darse cuenta de que estaba hablando de otro catálogo. */}
      <div className="px-6 py-4">
        {isPending ? (
          <Text size="small" className="text-ui-fg-subtle">
            Cargando…
          </Text>
        ) : data?.configured ? (
          <Text size="small">
            Hoy el bot busca en:{' '}
            <span className="txt-compact-small-plus">
              {selected.map(nameOf).join(' · ') || '—'}
            </span>
            .{' '}
            {selected.length > 1 ? (
              <span className="text-ui-fg-subtle">
                Los pedidos se crean en <strong>{nameOf(selected[0]!)}</strong>, que es el
                primero de la lista.
              </span>
            ) : null}
          </Text>
        ) : (
          <Text size="small" className="text-ui-fg-subtle">
            {data?.env_fallback
              ? `Sin selección, el bot está usando el canal de la variable de entorno (${data.env_fallback}).`
              : 'Sin selección, el bot usa el canal por defecto de la tienda — que puede no ser el catálogo que querés vender por WhatsApp.'}
          </Text>
        )}
      </div>

      <div className="flex flex-col gap-y-2 px-6 py-4">
        <Label size="small">Canales de venta</Label>
        {isPending ? null : channels.length === 0 ? (
          <Text size="small" className="text-ui-fg-subtle">
            No hay canales de venta en la tienda.
          </Text>
        ) : (
          channels.map((channel) => {
            const checked = selected.includes(channel.id);
            const order = checked ? selected.indexOf(channel.id) + 1 : null;
            return (
              <div key={channel.id} className="flex items-center gap-x-3">
                <Checkbox
                  id={`wa-channel-${channel.id}`}
                  checked={checked}
                  onCheckedChange={() => toggle(channel.id)}
                />
                <Label htmlFor={`wa-channel-${channel.id}`} weight="plus" className="cursor-pointer">
                  {channel.name || channel.id}
                </Label>
                {channel.is_disabled ? (
                  <Badge size="2xsmall" color="grey">
                    deshabilitado
                  </Badge>
                ) : null}
                {order === 1 ? (
                  <Badge size="2xsmall" color="blue">
                    pedidos acá
                  </Badge>
                ) : order ? (
                  <Badge size="2xsmall">{order}º</Badge>
                ) : null}
              </div>
            );
          })
        )}
        {/*
          Acá vivía la regla de "con varios canales el bot busca en todos, pero un
          pedido pertenece a UNO: el primero que tenga todos los productos". Se mudó
          al drawer de WhatsApp (sección "El catálogo que atiende el bot"), donde
          además se dice la consecuencia que faltaba: un carrito armado con productos
          de dos canales no se puede cerrar. Era cierto SIEMPRE, así que estaba abajo
          de la lista todo el tiempo sin depender de qué hubiera elegido nadie; lo que
          SÍ depende de la selección —qué canal recibe los pedidos— sigue arriba, en
          el resumen condicional de `selected.length > 1`.
        */}
      </div>

      <div className="flex items-center gap-x-2 px-6 py-4">
        <Button
          size="small"
          disabled={!dirty}
          isLoading={save.isPending}
          onClick={() => save.mutate({ sales_channel_ids: selected })}
        >
          Guardar
        </Button>
        {dirty ? (
          <Button
            size="small"
            variant="secondary"
            onClick={() => {
              setDirty(false);
              setSelected(data?.bot_channels.sales_channel_ids ?? []);
            }}
          >
            Descartar
          </Button>
        ) : null}
      </div>
    </Container>
  );
}
