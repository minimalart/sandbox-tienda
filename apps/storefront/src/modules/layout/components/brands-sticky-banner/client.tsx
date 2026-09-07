'use client';

import LocalizedClientLink from '@modules/common/components/localized-client-link';
import { useBannersByPlacement } from '@lib/context/banners-context';
import {
  FLOATING_LAYER,
  floatingObstacle,
} from '@lib/util/floating-obstacle';
import { AnimatePresence, motion } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const DISMISS_KEY = 'brands-sticky-banner-dismissed';

/**
 * MARCAS DEL BANNER.
 *
 * Única fuente: el placement `sticky_footer` del backoffice de Banners (cada
 * enlace = una marca: imagen=logo, url=link). Sin banner publicado el footer
 * sticky NO se renderiza — no hay lista de respaldo hardcodeada.
 *
 * - `name`: nombre de la marca (link /store?brand=NAME y texto si no hay logo).
 * - `src` (opcional): ruta del logo (ej: '/brands/acme.svg').
 */
type Brand = { name: string; src?: string; href?: string };

const BrandLogo = ({ brand }: { brand: Brand }) => {
  const [failed, setFailed] = useState(false);
  const showImage = brand.src && !failed;

  return (
    <LocalizedClientLink
      href={brand.href || `/store?brand=${encodeURIComponent(brand.name)}`}
      className='flex h-[40px] min-w-[68px] shrink-0 items-center justify-center rounded-lg bg-white px-3 transition hover:bg-gray-100'
    >
      {showImage ? (
        // biome-ignore lint/a11y/useAltText: alt provisto
        <img
          alt={brand.name}
          src={brand.src}
          onError={() => setFailed(true)}
          className='h-full w-full object-contain py-1.5'
        />
      ) : (
        <span className='whitespace-nowrap font-semibold text-[#1a1a4e] text-xs'>
          {brand.name}
        </span>
      )}
    </LocalizedClientLink>
  );
};

/** Deriva un nombre legible desde el link (ej. /store?brand=Acme → "Acme"). */
const deriveName = (url?: string): string => {
  if (!url) return '';
  const m = url.match(/brand=([^&]+)/i);
  if (m?.[1]) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }
  return '';
};

/**
 * Footer sticky configurable desde el placement `sticky_footer` de Banners: el
 * PRIMER banner define el footer completo — color de fondo, título (+color),
 * subtítulo opcional y una lista de enlaces (logo + link c/u). Si no hay banner
 * publicado en ese placement, el footer sticky no se muestra (está apagado).
 * Aparece al scrollear, se cierra por sesión y se oculta en /store y /products.
 */
export default function BrandsStickyBannerClient() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  const { banners } = useBannersByPlacement('sticky_footer');
  const cfg = banners[0];

  // Banner configurado sin logos → modo solo-botón (sin marcas de respaldo).
  const brands = useMemo<Brand[]>(
    () =>
      (cfg?.links ?? [])
        .map((l) => ({ name: deriveName(l.url), src: l.image, href: l.url }))
        .filter((b) => b.src || b.href || b.name)
        .slice(0, 4), // hasta 4 destacados
    [cfg],
  );

  // Default to the tenant accent color (was a hardcoded navy gradient) so the
  // "Nuestras marcas" banner matches the active theme / demo branding.
  const bg = cfg?.card_color || 'var(--accent-color)';
  const fg = cfg?.color_font || '#ffffff';
  const title = cfg?.title || 'Nuestras marcas';
  const subtitle = cfg?.subtitle;
  // CTA configurable desde el banner (botón + link). Default: "Ver todas → /store".
  const ctaHref = cfg?.cta_href || '/store';
  const ctaText = cfg?.cta_text || 'Ver todas →';
  const ctaOnly = brands.length === 0;

  const onFilterablePage =
    !!pathname && (pathname.includes('/store') || pathname.includes('/products'));

  useEffect(() => {
    try {
      setDismissed(window.sessionStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 300);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* noop */
    }
  };

  // El footer sticky se maneja 100% desde Banners → placement `sticky_footer`.
  // El endpoint /store/banners solo devuelve banners PUBLICADOS y dentro de su
  // ventana de fechas, así que "sin cfg" = deshabilitado (borrador, archivado,
  // vencido, otro sales channel o inexistente) y no se renderiza nada. Antes
  // caíamos a un look por defecto ("Nuestras marcas" + marcas de respaldo), que
  // hacía aparecer el sticky en tiendas donde estaba apagado (p.ej. desdeelsur).
  if (!cfg) return null;

  if (!brands.length && !ctaHref) return null;

  return (
    <AnimatePresence>
      {visible && !dismissed && !onFilterablePage && (
        <motion.div
          {...floatingObstacle('brands-sticky-banner', FLOATING_LAYER.stackedBar)}
          animate={{ y: 0, opacity: 1 }}
          className='fixed inset-x-0 bottom-[calc(64px+max(0.75rem,env(safe-area-inset-bottom)))] z-[48] lg:bottom-0 lg:z-[60]'
          exit={{ y: 120, opacity: 0 }}
          initial={{ y: 120, opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <div
            className={`relative mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5 shadow-2xl sm:rounded-t-2xl sm:px-6 ${
              bg ? '' : 'bg-gradient-to-r from-[#1a1a4e] via-[#2d2d7b] to-[#1a1a4e]'
            }`}
            style={bg ? { backgroundColor: bg } : undefined}
          >
            <button
              aria-label='Cerrar'
              className='-top-3 absolute right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-gray-600 shadow-md transition hover:text-gray-900'
              onClick={dismiss}
              type='button'
            >
              <XMarkIcon className='h-3.5 w-3.5' />
            </button>

            <div
              className={`shrink-0 flex-col justify-center ${ctaOnly ? 'flex' : 'hidden sm:flex'}`}
              style={{ color: fg }}
            >
              <div className='flex items-center gap-1.5'>
                <span className='font-semibold text-sm'>{title}</span>
              </div>
              {subtitle ? (
                <span className='text-xs opacity-80'>{subtitle}</span>
              ) : null}
            </div>

            {ctaOnly ? (
              <div className='flex flex-1 items-center justify-end'>
                <LocalizedClientLink
                  href={ctaHref}
                  className='inline-flex shrink-0 items-center rounded-full bg-white px-4 py-1.5 font-semibold text-xs transition hover:bg-gray-100'
                  style={{ color: bg || '#1a1a4e' }}
                >
                  {ctaText}
                </LocalizedClientLink>
              </div>
            ) : (
              <>
                <div className='flex flex-1 items-center gap-2 overflow-x-auto scrollbar-hide'>
                  {brands.map((brand, i) => (
                    <BrandLogo key={`${brand.name}-${i}`} brand={brand} />
                  ))}
                </div>

                <LocalizedClientLink
                  href={ctaHref}
                  className='hidden shrink-0 items-center rounded-full bg-white px-4 py-1.5 font-semibold text-xs transition hover:bg-gray-100 sm:inline-flex'
                  style={{ color: bg || '#1a1a4e' }}
                >
                  {ctaText}
                </LocalizedClientLink>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
