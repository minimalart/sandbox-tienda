'use client';

import { useSafeBottomOffset } from '@lib/hooks/use-safe-bottom-offset';
import {
  FLOATING_LAYER,
  floatingObstacle,
} from '@lib/util/floating-obstacle';
import LocalizedClientLink from '@modules/common/components/localized-client-link';
import { useEffect, useRef, useState } from 'react';

const CONSENT_COOKIE = 'cookie_consent';
// Un año: recordamos la elección del visitante para no volver a molestarlo.
const CONSENT_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Por ENCIMA del nav mobile (9999): el banner es un gate de consentimiento y
 * tiene que quedar accionable incluso si la medición del offset fallara. La
 * geometría la resuelve `useSafeBottomOffset`, así que en condiciones normales
 * ni se tocan.
 */
const Z_INDEX = 10000;

const hasConsentCookie = () => {
  try {
    return document.cookie
      .split('; ')
      .some((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  } catch {
    return true; // ante la duda, no mostramos el banner
  }
};

const persistChoice = (value: 'accepted' | 'rejected') => {
  try {
    document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${CONSENT_MAX_AGE}; samesite=lax`;
  } catch {
    /* noop */
  }
};

/**
 * Banner de consentimiento de cookies. Se muestra solo cuando la preferencia
 * "Banner de cookies" está activa en Admin → Preferencias → Tienda (el layout
 * decide server-side si montar este componente).
 *
 * Persistimos la elección (aceptar/rechazar) en una cookie de un año para no
 * volver a mostrarlo. Arranca oculto y se revela en un efecto para evitar
 * mismatch de hidratación (la cookie solo se conoce en el cliente).
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasConsentCookie()) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const choose = (value: 'accepted' | 'rejected') => {
    persistChoice(value);
    setVisible(false);
  };

  // El banner va en un componente aparte para que su primer render ya tenga el
  // nodo montado y `useSafeBottomOffset` mida en el mismo frame en que aparece.
  return <CookieConsentBanner onChoose={choose} />;
}

/**
 * Cartel en sí. No se ancla a `bottom-0`: el offset se mide en runtime para
 * quedar por arriba del nav inferior mobile, de la barra de agregar al carrito
 * del PDP o de cualquier otra barra pegada al borde. Antes vivía en `bottom-0`
 * con z-index por debajo del nav (9998 vs 9999), así que en mobile el nav lo
 * tapaba y los botones Aceptar/Rechazar quedaban inaccesibles.
 */
function CookieConsentBanner({
  onChoose,
}: {
  onChoose: (value: 'accepted' | 'rejected') => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const bottom = useSafeBottomOffset(ref, 0, FLOATING_LAYER.notice);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-live="polite"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 px-4 pb-4 transition-[bottom] duration-300"
      style={{ bottom, zIndex: Z_INDEX }}
      {...floatingObstacle('cookie-consent', FLOATING_LAYER.notice)}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="text-sm text-neutral-700">
          Usamos cookies para mejorar tu experiencia de navegación. Podés aceptar
          su uso o rechazarlas.{' '}
          <LocalizedClientLink
            href="/legal/legals"
            className="font-medium text-neutral-900 underline underline-offset-2"
          >
            Más información
          </LocalizedClientLink>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => onChoose('rejected')}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Rechazar
          </button>
          <button
            type="button"
            onClick={() => onChoose('accepted')}
            className="rounded-lg bg-[--primary-color] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
