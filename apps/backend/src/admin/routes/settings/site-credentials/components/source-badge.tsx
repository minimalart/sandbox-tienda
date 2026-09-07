import { Badge, Tooltip } from '@medusajs/ui';
import type { SiteCredentialSource } from '../../../../hooks/api/site-credentials';

/**
 * De dónde salen HOY las credenciales que va a usar el provider.
 *
 * Es el dato central de la pantalla y el que hoy no existe en ningún lado: mirar la
 * tabla no alcanza —una fila ilegible NO es "usa las del entorno", es "no despacha"—
 * y mirar el `.env` tampoco, porque la fila de la tienda le gana. El backend lo
 * resuelve con el MISMO lector que los providers (`readSiteCredentialsViaSql`), así
 * que este badge no es una deducción de la UI: es lo que va a pasar de verdad.
 *
 * `source` solo no alcanza para explicar `'none'` sin mentir. El contrato
 * (`api/admin/site-credentials/route.ts`) mapea a `'none'` DOS situaciones que un
 * operador tiene que distinguir para saber qué hacer:
 *
 *  1. Tienda NO principal sin fila propia: el entorno puede tener credenciales
 *     perfectamente buenas y aun así no se usan, porque la regla fail-closed nunca
 *     deja caer una tienda no principal al entorno. El copy anterior decía "ni
 *     propias de la tienda ni del entorno" — **falso** cuando `env_available` es
 *     `true`, y ese es justo el caso más común (instancia con credenciales
 *     compartidas y una tienda nueva sin cuenta propia todavía). Un operador que lee
 *     eso concluye "no hay nada configurado en ningún lado" cuando en realidad hay
 *     una cuenta perfectamente usable a la que su tienda no puede acceder por
 *     diseño. La confusión inversa —creer que SÍ hereda cuando no— es la que factura
 *     con la cuenta de otro titular, así que el copy tiene que nombrar la causa real.
 *  2. Cualquier otro `'none'` (sin fila, o tienda principal sin fila y sin entorno):
 *     ahí sí no hay nada que usar, en ningún lado.
 *
 * Por eso el badge recibe `isMainSite` y `envAvailable` además de `source`: sin esos
 * dos datos no puede elegir el mensaje correcto sin arriesgarse a mentir.
 */

type SourceBadgeCopy = { label: string; color: 'green' | 'grey' | 'red'; detail: string };

const copyFor = (
  source: SiteCredentialSource,
  isMainSite: boolean,
  envAvailable: boolean,
): SourceBadgeCopy => {
  if (source === 'site') {
    return {
      label: 'Cuenta propia de la tienda',
      color: 'green',
      detail: isMainSite
        ? 'Esta tienda opera con las credenciales que tiene cargadas acá. Si las borrás, vuelve a las del entorno (si existen).'
        : 'Esta tienda opera con las credenciales que tiene cargadas acá. Si las borrás, la integración queda APAGADA: una tienda no principal nunca hereda del entorno.',
    };
  }

  if (source === 'env') {
    return {
      label: 'Hereda la del entorno',
      color: 'grey',
      detail:
        'Esta tienda NO tiene cuenta propia: opera con las credenciales de la instancia, las mismas que comparten todas las tiendas sin cuenta propia. Sólo puede pasar en la tienda principal — el resto se apaga en su lugar.',
    };
  }

  // source === 'none': la tienda no va a operar con nada. La causa cambia el mensaje.
  if (!isMainSite && envAvailable) {
    return {
      label: 'Apagada: no hereda del entorno',
      color: 'red',
      detail:
        'El entorno SÍ tiene credenciales cargadas, pero esta tienda no es la principal y por regla fail-closed nunca las hereda: evita despachar o cobrar con la cuenta de otro titular. Cargá una cuenta propia de esta tienda para prenderla.',
    };
  }

  return {
    label: 'Sin credenciales',
    color: 'red',
    detail:
      'No hay credenciales usables ni en la tienda ni en el entorno. La integración no va a funcionar para esta tienda.',
  };
};

type Props = {
  source: SiteCredentialSource;
  isMainSite: boolean;
  envAvailable: boolean;
};

export const SourceBadge = ({ source, isMainSite, envAvailable }: Props) => {
  const copy = copyFor(source, isMainSite, envAvailable);
  return (
    <Tooltip content={copy.detail}>
      <span className="inline-flex cursor-help items-center">
        <Badge size="2xsmall" color={copy.color} rounded="full">
          {copy.label}
        </Badge>
      </span>
    </Tooltip>
  );
};

/** Fecha corta para "guardado el …". El backend devuelve ISO o `null`. */
export const formatSavedAt = (iso: string | null): string | null => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('es-AR');
};
