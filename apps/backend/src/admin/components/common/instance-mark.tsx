import { Text, Tooltip, clx } from '@medusajs/ui';
import {
  useInstanceBranding,
  useInstanceFavicon,
  useInstanceTitle,
} from '../../hooks/use-instance-branding';

type Props = {
  /** `topbar` va en la barra de toda pantalla; `login` arriba del formulario. */
  variant: 'topbar' | 'login';
};

/**
 * Qué instalación es ésta: logo + nombre.
 *
 * EL PROBLEMA QUE RESUELVE: con varios Medusa abiertos a la vez, nada en pantalla
 * dice cuál es cuál. El sidebar muestra `store.name` en gris chico, la pestaña no
 * tiene favicon (el admin declara uno en blanco) y el título es `"<Página> - Medusa"`
 * en todas las instalaciones, así que la única forma de saberlo es mirar la URL.
 *
 * MONTA TAMBIÉN EL FAVICON Y EL TÍTULO, además de dibujar. Los dos widgets que usan
 * este componente cubren entre ellos todas las pantallas —`topbar` post-login,
 * `login` antes—, así que la pestaña queda identificada en todo momento sin depender
 * de ninguna pantalla en particular.
 */
export const InstanceMark = ({ variant }: Props) => {
  const branding = useInstanceBranding();

  // Antes del `if` de abajo: los hooks no pueden quedar detrás de un return. El del
  // favicon no depende de la marca (apunta siempre a `/favicon.ico`), así que corre
  // aunque la query todavía no haya resuelto.
  useInstanceFavicon();
  useInstanceTitle(branding?.name);

  // Hasta que resuelva la query no se dibuja nada. Un esqueleto acá parpadearía en
  // cada carga del admin y el dato es puramente informativo.
  if (!branding) return null;

  const { name, initial, color } = branding;
  const logo = branding.logo ?? branding.icon;
  if (!name && !logo) return null;

  const isLogin = variant === 'login';

  /**
   * El logo va SIEMPRE sobre blanco, nunca sobre el fondo del admin.
   *
   * `theme.logo` es el positivo, pensado para fondos claros, y el admin tiene modo
   * oscuro: pintarlo sobre `bg-ui-bg-base` lo hace desaparecer en dark. Hay variantes
   * en negativo en el theme (`logo_negative`), pero elegirlas pide detectar el tema
   * y la mitad de las instalaciones no las cargó. Es la misma decisión que ya tomó la
   * barra inferior mobile del storefront: círculo blanco y siempre el positivo
   * (`modules/demo-store/templates/shared.ts`).
   */
  const mark = logo ? (
    <span
      className={clx(
        'flex items-center justify-center rounded bg-white',
        isLogin ? 'h-12 px-2' : 'h-6 px-1',
      )}
    >
      <img
        src={logo}
        alt={name ?? ''}
        className={clx(
          'w-auto object-contain',
          isLogin ? 'max-h-8 max-w-[160px]' : 'max-h-4 max-w-[96px]',
        )}
      />
    </span>
  ) : (
    <span
      className={clx(
        'flex shrink-0 items-center justify-center rounded font-semibold text-white',
        isLogin ? 'h-12 w-12 text-xl' : 'h-6 w-6 text-xs',
      )}
      style={{ backgroundColor: color }}
    >
      {initial}
    </span>
  );

  if (isLogin) {
    /**
     * Con logo NO va el nombre en texto: el logo ya lo dice y repetirlo abajo es
     * ruido. El nombre sale sólo cuando la marca es la inicial de fallback, que
     * sola no identifica la instalación.
     */
    return (
      <div className="mb-2 flex flex-col items-center gap-y-2">
        {mark}
        {!logo && name ? (
          <Text size="small" weight="plus" className="text-ui-fg-base text-center">
            {name}
          </Text>
        ) : null}
      </div>
    );
  }

  /**
   * Misma regla que en el login: con logo NO va el nombre. El logo ya identifica la
   * instalación y el texto al lado duplicaba la marca. El nombre sale sólo cuando la
   * marca es la inicial de fallback, que sola no dice cuál es. El tooltip conserva el
   * nombre completo en los dos casos.
   */
  return (
    <Tooltip content={name ?? ''}>
      <div className="flex items-center gap-x-2 overflow-hidden">
        {mark}
        {/* En pantallas angostas la barra ya está apretada: queda sólo la marca. */}
        {!logo && name ? (
          <Text
            size="xsmall"
            weight="plus"
            className="text-ui-fg-subtle hidden max-w-[140px] truncate lg:block"
          >
            {name}
          </Text>
        ) : null}
      </div>
    </Tooltip>
  );
};
