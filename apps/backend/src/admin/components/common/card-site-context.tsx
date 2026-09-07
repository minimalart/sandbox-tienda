import { Buildings } from '@medusajs/icons';
import { Badge, Button, Select, Text, Tooltip } from '@medusajs/ui';
import { useActiveSite } from '../../hooks/use-active-site';

/**
 * Franja de contexto de tienda para UNA card de ajustes.
 *
 * CÓMO SE MONTA: va como primer hijo de la card, DEBAJO del título y encima del
 * contenido. Se dibuja a sangre (`border-b` + `bg-ui-bg-subtle`, sin margen ni radio)
 * porque el recuadro lo pone la card: un contenedor propio acá se leía como una card
 * chiquita flotando adentro de otra.
 *
 *     <Container className="p-0">
 *       <Heading>…</Heading>
 *       <CardSiteContext scope="site" dirty={form.formState.isDirty} />
 *       …
 *     </Container>
 *
 * POR QUÉ EL SCOPE ES EXPLÍCITO Y NO SE DEDUCE ACÁ: este componente no sabe de dónde
 * salen los datos de su card. Las ~27 páginas de `ExtensionSettingsCard` lo derivan
 * de `descriptor.scope` —ver `app-settings/settings-site-context.tsx`—, pero los
 * formularios escritos a mano (`erp/configuracion`, `loyalty/configuracion`, las
 * cards de `store-config/`) no tienen descriptores: su scope lo define la ruta que
 * consumen. La alternativa era un registro por pantalla como el de `lib/site-scope.ts`,
 * y su modo de falla ya está documentado ahí: la pantalla número 29 nace sin entrada,
 * cae al fallback y la franja miente sobre algo que el operador no puede verificar.
 * Pedirlo por prop lo vuelve un error de compilación en vez de un silencio.
 *
 * POR QUÉ `dirty` ES OBLIGATORIA Y NO TIENE DEFAULT: cambiar de tienda RECARGA la
 * página (ver `lib/active-site.ts`), así que un borrador en `useState` se pierde. Con
 * default `false` el modo de falla es pérdida de datos silenciosa en el consumidor
 * que se olvidó de pasarla; obligatoria, el peor caso es tipear `dirty={false}` en
 * una card de sólo lectura.
 *
 * NO ES `<SiteScopeBar>`, y no se unifica con ella a propósito: esa barra es para
 * pantallas de LISTA y responde otra pregunta —"¿esta lista filtra por tienda?"—, con
 * un segundo badge que declara si la pantalla respeta la selección. Acá la card SIEMPRE
 * respeta la tienda elegida, así que ese badge no tendría nada que decir.
 *
 * REGLA QUE ARREGLA: si la UI puede mostrar "Apagado en esta tienda", tiene que poder
 * mostrar CUÁL es esta tienda. Un cartel que dice "en esta tienda" sin nombrarla no
 * informa: desorienta.
 */

export type CardSiteContextScope = 'site' | 'instance';

type Props = {
  /**
   * Qué capa edita esta card.
   *
   *   `'site'`     — los valores se resuelven contra la tienda activa. Muestra el
   *                  selector, y el operador puede cambiar de tienda desde acá.
   *   `'instance'` — los valores son únicos para todo el backoffice. Muestra el
   *                  cartel que lo dice, sin selector.
   */
  scope: CardSiteContextScope;
  /**
   * Hay cambios sin guardar. Cambiar de tienda descarta el borrador —recargando o
   * remontando, según el modo—, así que con esto en `true` se pide confirmación.
   */
  dirty: boolean;
  /**
   * `false` = cambio EN CALIENTE: sólo se re-renderiza esta pantalla, sin recargar
   * el navegador. Opt-in, y el default es `true` a propósito. Misma prop y mismo
   * default que `SiteScopeBar`.
   *
   * Sólo es seguro si la pantalla cumple las TRES condiciones de
   * `SetActiveSiteOptions` (`lib/active-site.ts`). Ninguna es opcional, y la que más
   * se olvida es la tercera:
   *
   *  1. El `siteId` está en las query keys. El header no entra solo en la key, así
   *     que sin esto react-query devuelve el cache de la tienda anterior.
   *  2. El header viaja POR LLAMADA. `lib/http.ts` cumple —llama a `siteHeader()`
   *     adentro de `fetchJson`, en cada request—; el `sdk` NO, porque resuelve
   *     `globalHeaders` una sola vez al construirse y sin recarga queda viejo para
   *     siempre.
   *  3. **El llamador remonta con `key={activeId}`.** Sin eso, el borrador de la
   *     tienda A sobrevive al cambio y el próximo "Guardar" lo escribe en la B.
   *     Es el bug exacto que la recarga evitaba, y no avisa.
   *
   * Precedente completo: `settings/site-credentials`, que lo pide vía `SiteScopeBar`
   * y se remonta con `key={activeId ?? GLOBAL_KEY}`.
   */
  reloadOnChange?: boolean;
};

/** `null` no se puede usar como `value` de un `Select.Item`. */
const INSTANCE_OPTION = '__instance__';

export const CardSiteContext = ({ scope, dirty, reloadOnChange = true }: Props) => {
  const { activeSite, snapshot, sites, isPending, enabled, staleSelection, setActiveSite } =
    useActiveSite();

  // Sin módulo de tiendas no existe el concepto: mostrar "instancia" en un proyecto
  // mono-tienda es vocabulario que el operador no tiene por qué conocer.
  if (!isPending && !enabled) return null;

  /**
   * Todos los ajustes de esta card son de la instancia. Se dice explícitamente en vez
   * de no mostrar nada: en una pantalla donde la card de al lado SÍ tiene selector,
   * el silencio se lee como "se me olvidó", no como "no aplica".
   *
   * Va ANTES del chequeo de `staleSelection` a propósito: una card de instancia se
   * resuelve igual con una tienda muerta seleccionada, así que el cartel rojo sería
   * una alarma sobre algo que no la afecta.
   */
  if (scope === 'instance') {
    return (
      <div className="flex items-center gap-x-2 border-b bg-ui-bg-subtle px-6 py-2">
        <Buildings className="text-ui-fg-muted" />
        <Text size="small" className="text-ui-fg-subtle">
          Configuración de la instancia: es única para todo el backoffice y no cambia según la
          tienda que elijas.
        </Text>
      </div>
    );
  }

  /**
   * La tienda guardada ya no existe. Es el caso que deja TODAS las filas en "Apagado
   * en esta tienda" sin explicación: el backend resuelve un id stale como
   * `unknownSite` → `'secondary'` fail-closed (`precedence.ts:166-170`), o sea la
   * cascada `site ?? OFF` contra una tienda que no está. Sin una salida acá, la
   * pantalla es un callejón.
   */
  if (staleSelection) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-ui-tag-red-bg px-6 py-2">
        <Text size="small" weight="plus" className="text-ui-tag-red-text">
          La tienda seleccionada ya no existe.
        </Text>
        <Text size="small" className="text-ui-fg-subtle">
          Por eso todo aparece apagado: no hay tienda contra la cual resolver estos ajustes.
        </Text>
        <Button variant="secondary" size="small" onClick={() => setActiveSite(null)}>
          Ver la configuración de la instancia
        </Button>
      </div>
    );
  }

  const activeName = activeSite?.name ?? snapshot?.name ?? null;

  const onSelect = (value: string) => {
    const next = value === INSTANCE_OPTION ? null : value;
    // El borrador se pierde en los DOS modos —la recarga se lleva la página, el modo
    // caliente remonta con `key={activeId}`—, así que la confirmación no depende de
    // `reloadOnChange`. Lo que cambia es el precio de perderlo, no si se pierde.
    if (dirty && !window.confirm('Tenés cambios sin guardar. Si cambiás de tienda se pierden.')) {
      return;
    }
    setActiveSite(next, { reload: reloadOnChange });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-ui-bg-subtle px-6 py-2">
      <div className="flex items-center gap-x-2">
        <Buildings className="text-ui-fg-muted" />
        <Text size="small" weight="plus">
          Configurando
        </Text>
      </div>

      {/* Con una sola tienda no hay nada que elegir, pero SÍ hay algo que decir: el
          operador igual necesita saber contra qué se están resolviendo los valores. */}
      {sites.length <= 1 ? (
        <Badge size="2xsmall">{activeName ?? 'Configuración de la instancia'}</Badge>
      ) : (
        <Select value={activeSite?.id ?? INSTANCE_OPTION} onValueChange={onSelect}>
          <Select.Trigger className="w-64">
            <Select.Value placeholder="Elegí una tienda" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value={INSTANCE_OPTION}>Configuración de la instancia</Select.Item>
            {sites.map((site) => (
              <Select.Item key={site.id} value={site.id}>
                {site.name}
                {site.is_main ? ' (principal)' : ''}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      )}

      <Tooltip
        content={
          activeSite
            ? activeSite.is_main
              ? 'Es la tienda principal: lo que no tenga valor propio cae a la configuración de la instancia y, si tampoco hay, al entorno.'
              : 'No es la tienda principal: lo que no tenga valor propio queda APAGADO. Por diseño no hereda del entorno, para no operar con la cuenta de otra tienda.'
            : 'Sin tienda elegida se ve y se edita la configuración de la instancia, que es el fallback de las tiendas que no tengan valor propio.'
        }
      >
        <Text size="xsmall" className="cursor-help text-ui-fg-muted underline decoration-dotted">
          {activeSite ? (activeSite.is_main ? 'Hereda del entorno' : 'No hereda del entorno') : 'Capa de la instancia'}
        </Text>
      </Tooltip>
    </div>
  );
};
