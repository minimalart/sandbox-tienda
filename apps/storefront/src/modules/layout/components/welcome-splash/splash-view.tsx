'use client';

import { useBannersByPlacement } from '@lib/context/banners-context';
import { useTenantBrand } from '@lib/site-config/context';
import { motion } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  contrastingPlainColor,
  SPLASH_DEFAULT_BG,
} from './plain-color';

const DEFAULT_COUNTDOWN = 8;
const DEFAULT_BG = SPLASH_DEFAULT_BG;
const DEFAULT_FG = '#ffffff';
const BLOOM_DURATION_MS = 550;

/**
 * Vista del splash de bienvenida como PÁGINA dedicada (URL `/{cc}/splash`).
 * Antes era un overlay sobre la home y se veía raro; ahora vive en su propia
 * URL: el mobile redirige acá (ver redirect-controller) y, al cerrar o al
 * terminar la cuenta regresiva, volvemos a la home.
 *
 * Dos modos de fondo (banner.splash_bg):
 *  - `color` (default): color de fondo + color de texto configurables, logo
 *    opcional, título ARRIBA de la imagen, imagen centrada (~40% del alto) y
 *    subtítulo opcional.
 *  - `image`: la imagen (media_url) ocupa TODA la pantalla (object-cover) como
 *    fondo. El resto (logo, título, subtítulo) son overlays OPCIONALES: si se
 *    dejan vacíos, el splash es una sola imagen a pantalla completa.
 *
 * SIN botón/CTA. Cuenta regresiva de autocierre y X siempre presente.
 */
export default function WelcomeSplashView() {
  const { banners } = useBannersByPlacement('welcome_splash');
  const { logos } = useTenantBrand();
  const banner = banners[0];

  const countdownSeconds = useMemo(() => {
    const n = banner?.countdown_seconds;
    return Number.isFinite(n as number) && (n as number) >= 0
      ? Math.floor(n as number)
      : DEFAULT_COUNTDOWN;
  }, [banner]);

  // El fondo (animación de bloom) ya terminó de cargarse: recién entonces
  // mostramos la cuenta regresiva y empezamos a descontar el tiempo.
  const [ready, setReady] = useState(false);
  const [contentMotionComplete, setContentMotionComplete] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [remaining, setRemaining] = useState(countdownSeconds);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Si la imagen del banner no carga (p.ej. URL externa con hotlink-protection
  // que devuelve 403), la ocultamos: un `<img>` roto igual reserva su alto
  // (h-[40vh]) y, al estar el bloque centrado, empujaba el título fuera de la
  // vista (tapado por la barra del navegador / prompt de PWA).
  const [imageFailed, setImageFailed] = useState(false);

  // Momento de montaje, para descartar el "ghost click" de mobile (ver más
  // abajo, en onBackdropClick).
  const mountedAtRef = useRef<number>(Date.now());

  // Volver a la home (reemplazamos el historial para que el botón "atrás" no
  // regrese al splash).
  const goHome = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    window.location.replace('/');
  }, []);

  // El splash es SOLO mobile y se llega por un redirect server-side desde el
  // home. En mobile, el `touchend` con el que el usuario entró al sitio dispara
  // un `click` sintético ("ghost click") que, tras la navegación, cae sobre este
  // overlay a pantalla completa y lo cerraba al instante. Ignoramos cualquier
  // click de fondo durante una breve ventana tras el montaje; la X y la cuenta
  // regresiva no se ven afectadas.
  const onBackdropClick = useCallback(() => {
    if (Date.now() - mountedAtRef.current < 700) return;
    goHome();
  }, [goHome]);

  // Marcar el splash como visto (cookie de sesión) apenas se monta, para que el
  // home —que decide server-side si redirige acá— no vuelva a mostrarlo. Es una
  // cookie de sesión (sin max-age): se limpia al cerrar el navegador.
  useEffect(() => {
    try {
      document.cookie = "welcome-splash-shown=1; path=/; samesite=lax";
    } catch {
      /* noop */
    }
  }, []);

  // Si no hay banner configurado, no hay nada que mostrar: a la home.
  useEffect(() => {
    if (!banner) {
      goHome();
    }
  }, [banner, goHome]);

  // Fallback: si por algún motivo el evento de fin de animación del bloom no
  // dispara (p.ej. prefers-reduced-motion), marcamos `ready` igual para que la
  // cuenta regresiva arranque y el splash no quede abierto para siempre.
  useEffect(() => {
    const id = setTimeout(() => setReady(true), BLOOM_DURATION_MS + 150);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setContentMotionComplete(true), 950);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    setImageFailed(false);
    setImageLoaded(!banner?.image);
  }, [banner?.image]);

  useEffect(() => {
    if (!banner?.image || imageFailed) {
      setImageLoaded(true);
      return;
    }

    const image = imageRef.current;
    if (!image?.complete) return;

    if (image.naturalWidth > 0) {
      setImageLoaded(true);
    } else {
      setImageFailed(true);
    }
  }, [banner?.image, imageFailed]);

  const countdownReady = ready && contentMotionComplete && imageLoaded;

  // Cuenta regresiva de autocierre: solo arranca cuando el fondo terminó de
  // cargarse (ready), para no descontar tiempo durante la animación.
  useEffect(() => {
    if (!countdownReady || countdownSeconds <= 0) return;
    setRemaining(countdownSeconds);
    timerRef.current = setInterval(() => {
      setRemaining((r) => Math.max(r - 1, 0));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [countdownReady, countdownSeconds]);

  useEffect(() => {
    if (!countdownReady || countdownSeconds <= 0 || remaining > 0) return;
    goHome();
  }, [countdownReady, countdownSeconds, remaining, goHome]);

  if (!banner) return null;

  const bg = banner.card_color || DEFAULT_BG;
  const fg = banner.color_font || DEFAULT_FG;
  // Color pleno de base, contrastante con el color del splash. El splash entra
  // animado (bloom) por encima de este color.
  const plainColor = contrastingPlainColor(bg);
  // Modo "imagen de fondo": la imagen ocupa toda la pantalla en lugar de ir
  // centrada y contenida. Solo aplica si efectivamente hay imagen y no falló.
  const isImageBg = banner.splash_bg === 'image' && !!banner.image && !imageFailed;
  const title = banner.title;
  // `banner.text` cae al título cuando no hay body, así que evitamos mostrar el
  // subtítulo si terminaría duplicando el título.
  const rawSubtitle = banner.subtitle || banner.text;
  const subtitle = rawSubtitle && rawSubtitle !== title ? rawSubtitle : undefined;
  const logo = logos?.mobile || logos?.main;
  const showLogo = banner.show_logo && !!logo;

  return (
    <div
      className='fixed inset-0 isolate z-[10000] flex flex-col items-center justify-center gap-6 overflow-hidden px-6 text-center'
      style={{
        // Color pleno de base (contrastante). El color del splash entra animado
        // (bloom) por encima. Lo pintamos acá —además del layout— para que sea
        // auto-contenido y nunca quede el fondo blanco del body. En modo imagen
        // usamos el color de fondo como base neutra mientras la imagen carga.
        backgroundColor: isImageBg ? bg : plainColor,
        color: fg,
      }}
      onClick={onBackdropClick}
      role='dialog'
      aria-label='Bienvenida'
    >
      {/* Keyframes del bloom. Incluyen el translate de centrado dentro del
          propio transform: usar clases Tailwind de translate junto a una
          animación de scale rompía el centrado (el transform de la animación
          pisa el de Tailwind) y dejaba parte de la pantalla sin cubrir. */}
      <style>{`@keyframes welcome-splash-bloom {
        from { transform: translate(-50%, -50%) scale(0); }
        to { transform: translate(-50%, -50%) scale(1); }
      }`}</style>

      {isImageBg ? (
        /* Modo imagen: la imagen ocupa TODA la pantalla (object-cover) como
            fondo. Aparece con un fade suave al terminar de cargar. Es el fondo
            del splash: título/subtítulo/logo van por encima (opcionales). */
        // biome-ignore lint/a11y/useAltText: alt provisto
        <img
          ref={imageRef}
          src={banner.image}
          alt={title || 'Bienvenida'}
          aria-hidden={!title}
          className={`absolute inset-0 z-0 h-full w-full object-cover transition-opacity duration-500 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => {
            setImageLoaded(true);
            setReady(true);
          }}
          onError={() => {
            setImageFailed(true);
            setImageLoaded(true);
            setReady(true);
          }}
        />
      ) : (
        /* El color de fondo del splash aparece ANIMADO: un círculo que crece
            desde el centro sobre el color pleno de base. El estado base (sin
            animación) ya está LLENO (scale 1), así que aunque la animación no
            corra, el color del splash cubre toda la pantalla (nunca blanco). */
        <div
          aria-hidden='true'
          className='absolute top-1/2 left-1/2 z-0 aspect-square w-[220vmax] rounded-full'
          style={{
            backgroundColor: bg,
            transform: 'translate(-50%, -50%) scale(1)',
            animation:
              'welcome-splash-bloom 0.55s cubic-bezier(0.22, 1, 0.36, 1) both',
          }}
          onAnimationEnd={() => setReady(true)}
        />
      )}

      {/* X siempre presente. Chip de fondo plano oscuro + glifo blanco: contrasta
          sobre cualquier fondo (imagen clara u oscura, o color pleno), en vez de
          heredar el color de texto del splash (que podía quedar invisible). */}
      <button
        aria-label='Cerrar'
        className='absolute top-5 right-5 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900/80 text-white shadow-md ring-1 ring-white/25 transition hover:bg-neutral-900'
        onClick={(e) => {
          e.stopPropagation();
          goHome();
        }}
        type='button'
      >
        <XMarkIcon className='h-5 w-5' />
      </button>

      {/* Cuenta regresiva (solo una vez cargado el fondo). Mismo chip plano que
          la X para que ambos controles superiores destaquen y sean legibles. */}
      {countdownReady && countdownSeconds > 0 && (
        <div className='absolute top-5 left-5 z-30 flex h-9 items-center rounded-full bg-neutral-900/80 px-3 text-xs font-medium text-white shadow-md ring-1 ring-white/25'>
          Cierra en {remaining}s
        </div>
      )}

      <motion.div
        className='relative z-10 flex w-full max-w-sm flex-col items-center gap-5'
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4, ease: 'easeOut' }}
        onAnimationComplete={() => setContentMotionComplete(true)}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Logo arriba del título (opcional, toggle desde el banner) */}
        {showLogo ? (
          <div className='flex h-14 items-center justify-center rounded-2xl bg-white px-5 shadow-lg'>
            {/* biome-ignore lint/a11y/useAltText: logo decorativo */}
            <img src={logo} alt='' className='h-9 w-auto object-contain' />
          </div>
        ) : null}

        {/* Título ARRIBA de la imagen */}
        {title ? (
          <h2
            className='font-bold text-2xl leading-tight'
            style={{ color: fg }}
          >
            {title}
          </h2>
        ) : null}

        {/* Imagen centrada (alto y ancho), ~40% del alto. Si falla la carga la
            ocultamos para no dejar un hueco que descentre el resto. En modo
            imagen de fondo NO va acá: la imagen es el fondo a pantalla completa. */}
        {banner.image && !imageFailed && !isImageBg ? (
          // biome-ignore lint/a11y/useAltText: alt provisto
          <img
            ref={imageRef}
            src={banner.image}
            alt={title || 'Bienvenida'}
            className='h-[40vh] w-full object-contain'
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              setImageFailed(true);
              setImageLoaded(true);
            }}
          />
        ) : null}

        {subtitle ? (
          <p className='text-sm opacity-80' style={{ color: fg }}>
            {subtitle}
          </p>
        ) : null}
      </motion.div>
    </div>
  );
}
