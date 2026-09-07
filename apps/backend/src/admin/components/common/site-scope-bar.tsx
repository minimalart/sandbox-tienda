import { Badge, Select, Text, Tooltip } from '@medusajs/ui';
import { Buildings } from '@medusajs/icons';
import { registerSiteScopeBar } from '@minimalart/mercatto-plugin-runtime/admin';
import { useActiveSite } from '../../hooks/use-active-site';
import { resolveScreenScope, type SiteScopeState } from '../../lib/site-scope';

type SiteScopeBarProps = {
  /** Clave de la pantalla en `lib/site-scope.ts`. Sin entrada se asume no filtrada. */
  screen: string;
  /**
   * `false` = cambiar de tienda NO recarga la página. OPT-IN, y el default es `true`
   * a propósito: la recarga no está por comodidad sino porque la mitad de los hooks
   * del admin usan query keys constantes (`['banners']`) y un formulario precargado
   * con la tienda A y guardado desde la B **escribe en la equivocada**. Ver la nota
   * grande de `lib/active-site.ts`.
   *
   * Sólo puede pedirlo una pantalla que cumpla las TRES condiciones que documenta
   * `SetActiveSiteOptions`: `siteId` en la query key, header por llamada y remonte
   * del contenido con `key={siteId}`. Hoy son `settings/site-credentials` y
   * `settings/extension-settings`.
   */
  reloadOnChange?: boolean;
  /**
   * Agrega la opción "Configuración de la instancia" (tienda `null`) al principio.
   *
   * OPT-IN porque para casi todas las pantallas NO tiene sentido: en una lista de
   * banners o de marcas, "sin tienda" no es una capa que se pueda editar sino la
   * ausencia de filtro. La pide `settings/extension-settings`, donde la instancia es
   * una capa REAL y editable —el fallback del que heredan las tiendas que no tienen
   * valor propio—, y por eso necesitaba un selector propio hasta ahora.
   *
   * Integraciones también la usa para administrar los proveedores compartidos.
   */
  allowInstance?: boolean;
  instanceLabel?: string;
  /** Permite que enlaces directos muestren el ámbito global sin perder la tienda guardada. */
  instanceSelected?: boolean;
  onSiteChange?: (siteId: string | null) => void;
  /**
   * Cómo se apoya en la página.
   *
   *   `'bar'`  (default) — franja a sangre con borde inferior. Es lo correcto en
   *                        las pantallas de LISTA, donde va pegada abajo del header
   *                        y se lee como parte del encabezado.
   *   `'card'`           — recuadro redondeado con borde completo y su propio
   *                        margen. Es lo correcto en las pantallas de AJUSTES, donde
   *                        no hay header propio y lo que sigue son cards: a sangre
   *                        se leía como un header partido, flotando arriba de todo.
   *
   * Es una prop y no dos componentes a propósito. Antes `extension-settings` tenía
   * su propia barra justamente por esto —necesitaba el recuadro— y el resultado
   * fueron dos controles casi idénticos que ya habían empezado a divergir. La
   * diferencia es de CONTEXTO, no de comportamiento: el selector, el badge y la
   * lógica de cambio de tienda son los mismos en las dos.
   */
  variant?: 'bar' | 'card';
};

const SHELL: Record<'bar' | 'card', string> = {
  bar: 'justify-between gap-2 border-b border-ui-border-base px-6 py-2',
  card: 'mb-3 justify-between gap-x-3 gap-y-2 rounded-lg border border-ui-border-base px-4 py-2.5',
};

/** Valor centinela del `<Select>`: Radix no acepta `''` ni `null` como value. */
const INSTANCE_OPTION = '__instance__';

const SCOPE_COPY: Record<SiteScopeState, { label: string; detail: string; color: 'green' | 'orange' | 'grey' }> = {
  scoped: {
    label: 'Filtra por tienda',
    detail: 'Lo que ves y lo que edites acá pertenece a la tienda seleccionada.',
    color: 'green',
  },
  unscoped: {
    label: 'Todavía no filtra',
    detail:
      'Esta pantalla muestra datos de todas las tiendas, y lo que edites acá aplica a todas. Su migración está pendiente.',
    color: 'orange',
  },
  instance: {
    label: 'Configuración de la instancia',
    detail: 'Esto es único para todo el backoffice, por diseño. No cambia según la tienda seleccionada.',
    color: 'grey',
  },
};

/**
 * Barra de contexto de tienda.
 *
 * Se monta por pantalla con una línea, igual que `<ExtensionVersion />` — que ya está
 * en 61 archivos. No es por gusto: **no hay dónde montarla una sola vez**. El admin
 * no expone zona de shell, un plugin de Vite que envuelva cada `page.tsx` es
 * build-magic cuyo modo de falla es que la barra desaparezca en silencio, y un portal
 * fijo se superpone con los drawers de `@medusajs/ui`.
 *
 * Lo que hace que no mienta es el segundo badge: declara si ESTA pantalla respeta la
 * tienda elegida. Una barra que sólo dijera "Tienda: Norte" en una pantalla que
 * muestra las tres es peor que no tener barra.
 *
 * No se muestra con 0 ó 1 tienda: en una instalación mono-tienda —la mayoría de los
 * proyectos generados— no hay nada que elegir y sería puro ruido.
 */
export const SiteScopeBar = ({
  screen,
  reloadOnChange = true,
  allowInstance = false,
  instanceLabel = 'Configuración de la instancia',
  instanceSelected = false,
  onSiteChange,
  variant = 'bar',
}: SiteScopeBarProps) => {
  const { activeSite, snapshot, sites, isPending, enabled, staleSelection, setActiveSite } = useActiveSite();
  const scope = resolveScreenScope(screen);
  const showingInstance = allowInstance && (instanceSelected || !(activeSite?.id ?? snapshot?.id));
  const copy = SCOPE_COPY[showingInstance ? 'instance' : scope];

  // Sin módulo de tiendas, o con una sola, no hay nada que elegir: en instalaciones
  // mono-tienda —la mayoría de los proyectos generados— la barra sería puro ruido.
  if (!isPending && (!enabled || sites.length <= 1) && !allowInstance) return null;

  // Con `allowInstance`, "sin tienda" es una elección legítima y tiene su propio
  // valor; sin él, sigue siendo el placeholder de "todavía no elegiste".
  const selected = showingInstance ? INSTANCE_OPTION : (activeSite?.id ?? snapshot?.id ?? '');
  const selectedName =
    showingInstance ? instanceLabel : (activeSite?.name ?? snapshot?.name ?? 'Todas las tiendas');

  return (
    <div className={`flex flex-wrap items-center bg-ui-bg-subtle ${SHELL[variant]}`}>
      <div className="flex items-center gap-2">
        <Buildings className="text-ui-fg-subtle" />
        <Text size="small" className="text-ui-fg-subtle">
          Tienda
        </Text>
        <Select
          size="small"
          value={selected}
          onValueChange={(value) => {
            const next = sites.find((site) => site.id === value);
            // Cambiar de tienda RECARGA salvo que la pantalla pida lo contrario:
            // ver la nota de `lib/active-site.ts` y la prop `reloadOnChange`.
            setActiveSite(next ? { id: next.id, slug: next.slug, name: next.name } : null, {
              reload: reloadOnChange,
            });
            onSiteChange?.(next?.id ?? null);
          }}
        >
          <Select.Trigger className="min-w-[190px]">
            <Select.Value placeholder={selectedName} />
          </Select.Trigger>
          <Select.Content>
            {allowInstance && (
              <Select.Item value={INSTANCE_OPTION}>{instanceLabel}</Select.Item>
            )}
            {sites.map((site) => (
              <Select.Item key={site.id} value={site.id}>
                {site.name}
                {site.is_main ? ' · principal' : ''}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>

        {staleSelection && !showingInstance && (
          <Tooltip content="La tienda que tenías seleccionada ya no existe. Elegí otra para volver a filtrar.">
            <span className="inline-flex items-center">
              <Badge size="2xsmall" color="red" rounded="full">
                tienda no encontrada
              </Badge>
            </span>
          </Tooltip>
        )}
      </div>

      <Tooltip content={copy.detail}>
        <span className="inline-flex cursor-help items-center">
          <Badge size="2xsmall" color={copy.color} rounded="full">
            {copy.label}
          </Badge>
        </span>
      </Tooltip>
    </div>
  );
};

// Registrar en el runtime contract para que los plugins publicados
// (@minimalart/mercatto-plugin-runtime/admin) rendericen la MISMA barra vía el
// slot `SiteScopeBar`. Como este archivo lo importan ~41 páginas del admin, la
// registración se dispara automáticamente al cargar el bundle. Los plugins
// tienen que importar SOLO el slot del contract, no este archivo — vive en
// `apps/backend/src/admin/*` y es inalcanzable desde node_modules.
registerSiteScopeBar(SiteScopeBar);

