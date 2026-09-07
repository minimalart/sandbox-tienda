import { Buildings } from '@medusajs/icons';
import { Badge, Container, Heading, Text } from '@medusajs/ui';
import { useQuery } from '@tanstack/react-query';
import { useActiveSite } from '../../../hooks/use-active-site';
import { fetchJson } from '../../../lib/http';

/**
 * Contra qué opera la tienda elegida, en la pestaña "Comercio". SÓLO LECTURA.
 *
 * Comercio es configuración de INSTANCIA y no puede ser otra cosa: un país pertenece a
 * una sola región en Medusa (`modules/demo-store/provision.ts:183-189`), así que no
 * existe "la región de Norte". La pestaña lo declara con el badge gris de
 * `SiteScopeBar`.
 *
 * Esta card es lo que evita que ese badge se lea como "no te incumbe". Lo que se
 * aplique arriba le cambia la moneda a las tiendas de abajo, y el operador tiene
 * derecho a ver cuáles antes de confirmar.
 */

type CommerceContext = {
  site: { id: string; name: string; is_main: boolean } | null;
  region: { id: string; name: string; currency_code: string; countries: string[] } | null;
  channels: { id: string; name: string }[];
};

const URL = '/admin/store-config/commerce/context';

export const CommerceContextCard = () => {
  // La tienda va en la key además de en el header: con una key constante, el contexto
  // de la tienda A se serviría desde caché al abrir la B.
  const { activeId, activeSite, enabled } = useActiveSite();
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['commerce-context', activeId],
    queryFn: () => fetchJson<CommerceContext>(URL),
  });

  // Sin módulo de tiendas no hay nada que desambiguar: la instancia ES la tienda, y
  // repetirlo sería vocabulario que el operador no tiene por qué conocer. Mismo
  // criterio que `SettingsSiteContext` (`settings-site-context.tsx:50`).
  if (!enabled) return null;

  /**
   * El nombre sale del MANIFEST (`activeSite`), y la respuesta queda sólo de respaldo.
   *
   * Con `data?.site?.name` solo, el encabezado dice "Configuración de la instancia"
   * mientras la lectura está en vuelo y también si falla — o sea, el operador que
   * eligió Norte lee un título que le afirma exactamente lo contrario, y este bloque
   * existe para no afirmar de más. El manifest ya viene del caché compartido de
   * `useActiveSite`, así que el nombre está desde el primer render y no hay flash.
   */
  const label = activeSite?.name ?? data?.site?.name ?? 'Configuración de la instancia';

  return (
    // `p-0` + header propio: la forma única de las cards de esta pantalla, ver
    // `branch-settings-card` para por qué no bajan a sección.
    <Container className="max-w-2xl p-0">
      <div className="flex items-center gap-x-2 px-6 py-4">
        <Buildings className="text-ui-fg-muted" />
        <Heading level="h2">Contra qué opera {label}</Heading>
      </div>

      <div className="flex flex-col gap-3 px-6 pb-6">
        {isPending ? (
          <Text size="small" className="text-ui-fg-muted">
            Leyendo…
          </Text>
        ) : isError ? (
          /*
            Una lectura FALLIDA no se pinta como "Sin región asignada".

            Sin esta rama el error caía al render normal con `data === undefined`, y ahí
            los dos estados se ven idénticos: "Sin región asignada" + "Sin canales". Pero
            uno es una afirmación sobre la tienda —está a medio provisionar, andá a
            arreglarla— y el otro es "no pude preguntar". Confundirlos manda al operador a
            revisar una tienda que está perfecta, que es el mismo tipo de mentira que esta
            card vino a sacar de la pestaña.
          */
          <Text size="small" className="text-ui-fg-error">
            No se pudo leer el contexto de comercio: {(error as Error)?.message ?? 'error desconocido'}
          </Text>
        ) : (
          <div className="flex flex-col gap-2">
            <Row label="Región">
              {data?.region ? (
                <span className="flex flex-wrap items-center gap-x-2">
                  <Text size="small">{data.region.name}</Text>
                  <Badge size="2xsmall">{data.region.currency_code.toUpperCase()}</Badge>
                  {data.region.countries.length > 0 && (
                    <Text size="xsmall" className="text-ui-fg-muted">
                      {data.region.countries.map((c) => c.toUpperCase()).join(', ')}
                    </Text>
                  )}
                </span>
              ) : (
                <Text size="small" className="text-ui-fg-muted">
                  Sin región asignada
                </Text>
              )}
            </Row>

            <Row label="Canales de venta">
              {data?.channels.length ? (
                <span className="flex flex-wrap gap-1">
                  {data.channels.map((channel) => (
                    <Badge key={channel.id} size="2xsmall">
                      {channel.name}
                    </Badge>
                  ))}
                </span>
              ) : (
                <Text size="small" className="text-ui-fg-muted">
                  Sin canales
                </Text>
              )}
            </Row>
          </div>
        )}

        <Text size="xsmall" className="text-ui-fg-muted">
          La región y la moneda las comparten todas las tiendas del mismo país: Medusa
          permite un solo país por región. Lo que aísla a cada tienda es su canal de venta.
        </Text>
      </div>
    </Container>
  );
};

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-wrap items-baseline gap-x-3">
    <Text size="small" weight="plus" className="w-36 shrink-0">
      {label}
    </Text>
    {children}
  </div>
);
