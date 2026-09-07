import { Badge, Tooltip } from '@medusajs/ui';
import {
  getPluginMeta,
  registerExtensionVersion,
} from '@minimalart/mercatto-plugin-runtime/admin';
import { EXTENSION_VERSIONS, type ExtensionKey } from '../../lib/extension-versions';
import {
  MULTISTORE_CAPABILITY_COPY,
  multistoreScopeOf,
  type MultistoreScope,
} from '../../lib/extension-multistore';

type ExtensionVersionProps = {
  /**
   * Clave de la extensión. Acepta `ExtensionKey` (in-tree) o cualquier `string`
   * porque los plugins publicados (fiscal-documentation, shop-by-looks,
   * gift-cards, …) NO están en `EXTENSION_VERSIONS` y empujan su slug via
   * `registerPluginMeta` desde su propio bundle.
   */
  extension: ExtensionKey | string;
};

const BADGE_BY_LEVEL: Record<
  MultistoreScope['level'],
  { text: string; color: 'green' | 'orange' | 'grey' }
> = {
  full: { text: 'Multitienda', color: 'green' },
  partial: { text: 'Multitienda parcial', color: 'orange' },
  none: { text: 'Sin multitienda', color: 'grey' },
};

const HEADLINE_BY_LEVEL: Record<MultistoreScope['level'], string> = {
  full: 'Todo se resuelve por tienda.',
  partial: 'Una parte se resuelve por tienda y otra no.',
  none: 'Nada se resuelve por tienda: lo que cambies acá afecta a todas.',
};

/** Detalle del alcance: las tres capacidades, incluidas las que faltan. */
const ScopeDetail = ({ scope }: { scope: MultistoreScope }) => (
  <div className="flex flex-col gap-1.5">
    <span className="font-medium">{HEADLINE_BY_LEVEL[scope.level]}</span>
    <ul className="flex flex-col gap-0.5">
      {scope.capabilities.map(({ capability, present }) => {
        const copy = MULTISTORE_CAPABILITY_COPY[capability];
        return (
          <li key={capability} className="flex items-baseline gap-1.5">
            <span aria-hidden>{present ? '✓' : '✕'}</span>
            <span>
              <span className="font-medium">{copy.label}</span>
              {': '}
              {present ? copy.present : copy.absent}
            </span>
          </li>
        );
      })}
    </ul>
  </div>
);

/**
 * Badge de versión de una extensión propia, más su alcance multitienda.
 *
 * El badge se lee de un vistazo ("Multitienda parcial") y el detalle vive en el
 * tooltip, que es donde puede explicarse sin ocupar el header. Lo importante es que
 * el tooltip enumera SIEMPRE las tres capacidades, también las que faltan: saber que
 * la configuración de esta pantalla es única para toda la instancia es justamente lo
 * que evita que alguien crea que está configurando su tienda.
 *
 * Versión: `lib/extension-versions.ts` (bump manual por deploy) para extensiones
 * IN-TREE; para plugins publicados cae a `getPluginMeta(extension)?.version` —
 * el plugin registra su propia versión en el bundle del admin, así el badge
 * nunca queda pelado ("v" sin número) cuando el plugin no está en la tabla del host.
 * Alcance: `lib/extension-multistore.ts` (espejo del catálogo, con test de drift).
 * `multistoreScopeOf` ya devuelve `level: 'none'` para claves desconocidas — sin
 * necesidad de guardar.
 */
export const ExtensionVersion = ({ extension }: ExtensionVersionProps) => {
  const scope = multistoreScopeOf(extension);
  const badge = BADGE_BY_LEVEL[scope.level];
  // Fallback en cadena: tabla estática del host → registro runtime del plugin →
  // literal `'?'`. El literal es a propósito: `undefined` rendariza el badge
  // como `"v"` (la letra pelada) y era exactamente el bug que este PR arregla.
  const version =
    (EXTENSION_VERSIONS as Record<string, string>)[extension] ??
    getPluginMeta(extension)?.version ??
    '?';

  return (
    // `inline-flex` en los dos wrappers, no sólo en el de afuera: un `span` inline
    // toma la altura de la LÍNEA DE TEXTO, no la del badge que contiene, y eso lo
    // descuelga del `<Heading>` con el que comparte el `flex items-center` de la
    // página. `leading-none` evita que el line-height heredado lo empuje otra vez.
    <span className="inline-flex items-center gap-1 leading-none">
      <Badge size="2xsmall" color="grey" rounded="full" title={`Versión de ${extension}`}>
        v{version}
      </Badge>
      <Tooltip content={<ScopeDetail scope={scope} />}>
        <span className="inline-flex cursor-help items-center">
          <Badge size="2xsmall" color={badge.color} rounded="full">
            <span className="inline-flex items-center gap-1">
              {badge.text}
              <span aria-hidden className="opacity-60">?</span>
            </span>
          </Badge>
        </span>
      </Tooltip>
    </span>
  );
};

// Registrar en el runtime contract: los plugins publicados
// (@minimalart/mercatto-plugin-runtime/admin) rendarizan el MISMO badge vía
// el slot `ExtensionVersion` sin importar este archivo (inalcanzable desde
// node_modules).
registerExtensionVersion(ExtensionVersion);
