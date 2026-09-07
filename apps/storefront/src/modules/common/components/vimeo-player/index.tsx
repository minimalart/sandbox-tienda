'use client'

import type PlayerType from '@vimeo/player'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from 'react'

/**
 * API imperativa expuesta por el player vía ref. Pensada para habilitar los
 * controles que vienen en próximos PRs (sonido, fullscreen) sin acoplar el
 * componente a ningún caso de uso concreto.
 */
export type VimeoPlayerHandle = {
  play: () => void
  pause: () => void
  setMuted: (muted: boolean) => void
  requestFullscreen: () => void
  exitFullscreen: () => void
  getPlayer: () => PlayerType | null
}

export type VimeoPlayerProps = {
  /** Id numérico del video de Vimeo (ej: "1198784691"). */
  videoId: string
  autoplay?: boolean
  loop?: boolean
  muted?: boolean
  controls?: boolean
  /**
   * Modo ambient de Vimeo: fuerza autoplay muteado en loop y oculta toda la
   * UI nativa. Útil para el clip de fondo de la sección shoppable.
   */
  background?: boolean
  /**
   * Pausar automáticamente cuando otro player de Vimeo se reproduce o se
   * oculta la pestaña. Conviene `false` para clips ambient/carrusel donde el
   * mismo componente controla qué se reproduce vía mount/unmount.
   */
  autopause?: boolean
  title?: string
  /** Clases para el contenedor que envuelve al iframe del SDK. */
  className?: string
  /** Estilos aplicados al iframe generado por el SDK (ej: cover-crop). */
  iframeStyle?: CSSProperties
  /**
   * Imagen de poster que se muestra ENCIMA del iframe mientras el clip carga
   * (evita la pantalla negra de Vimeo). Se desvanece al primer `play` y vuelve
   * a aparecer al cambiar de clip.
   */
  poster?: string
  onReady?: () => void
  onPlay?: () => void
  playSignal?: number | string | boolean
}

/**
 * Player de Vimeo reutilizable, construido sobre el SDK oficial
 * `@vimeo/player`. Es self-contained y NO conoce nada de productos ni de la
 * home: solo embebe un video y expone controles imperativos por ref. La
 * sección shoppable (u otra) lo consume y le agrega su capa encima.
 *
 * El SDK se importa dinámicamente dentro del effect para que nunca corra en
 * SSR (la librería toca `window`/`document` al instanciarse).
 */
const VimeoPlayer = forwardRef<VimeoPlayerHandle, VimeoPlayerProps>(
  function VimeoPlayer(
    {
      videoId,
      autoplay = true,
      loop = true,
      muted = true,
      controls = false,
      background = false,
      autopause = false,
      title,
      className,
      iframeStyle,
      poster,
      onReady,
      onPlay,
      playSignal,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    // Poster visible mientras el clip carga; se oculta al primer frame real.
    const [posterVisible, setPosterVisible] = useState(true)
    const playerRef = useRef<PlayerType | null>(null)
    const hasRenderedFrameRef = useRef(false)
    // Id actualmente cargado en el iframe. Permite cambiar de clip con
    // loadVideo() (mismo iframe) en vez de recrear el player.
    const loadedIdRef = useRef<string | null>(null)

    // Espejos "vivos" de props que necesitamos leer dentro de effects/loadVideo
    // sin meterlos en las dependencias (meterlos re-instanciaría el player).
    const mutedRef = useRef(muted)
    const autoplayRef = useRef(autoplay)
    const videoIdRef = useRef(videoId)
    mutedRef.current = muted
    autoplayRef.current = autoplay
    videoIdRef.current = videoId

    // Desmutar un autoplay hace que el navegador lo PAUSE (vimeo/player.js#793):
    // reproducir audio exige activación de usuario. Por eso, al desmutar,
    // reasertamos play() de forma SÍNCRONA — encadenarlo en `.then(setMuted)`
    // lo saca de la ventana del gesto (corre en un microtask posterior al
    // round-trip postMessage) y el navegador rechaza reanudar con sonido,
    // dejando el clip pausado. Síncrono, los tres mensajes heredan el gesto.
    const applyMuted = (m: boolean) => {
      const p = playerRef.current
      if (!p) return
      if (m) {
        p.setMuted(true)?.catch(() => {})
        return
      }
      p.setMuted(false)?.catch(() => {})
      p.setVolume(1)?.catch(() => {})
      p.play()?.catch(() => {})
    }

    // Callbacks y estilos en refs: así el effect no se re-ejecuta (ni
    // re-instancia el player) cuando el padre pasa funciones/objetos inline.
    const onPlayRef = useRef(onPlay)
    const onReadyRef = useRef(onReady)
    const iframeStyleRef = useRef(iframeStyle)
    onPlayRef.current = onPlay
    onReadyRef.current = onReady
    iframeStyleRef.current = iframeStyle

    useImperativeHandle(
      ref,
      () => ({
        play: () => void playerRef.current?.play()?.catch(() => {}),
        pause: () => void playerRef.current?.pause()?.catch(() => {}),
        setMuted: (m: boolean) => applyMuted(m),
        requestFullscreen: () =>
          void playerRef.current?.requestFullscreen()?.catch(() => {}),
        exitFullscreen: () =>
          void playerRef.current?.exitFullscreen()?.catch(() => {}),
        getPlayer: () => playerRef.current,
      }),
      [],
    )

    // Sincroniza el sonido cuando cambia el prop (toggle propio o estado
    // compartido entre superficies). El toggle también llama setMuted vía ref
    // de forma síncrona para no perder el gesto; esto es el respaldo.
    useEffect(() => {
      applyMuted(muted)
    }, [muted])

    // Cambiar de clip SIN recrear el iframe. Recrearlo descarta el "desbloqueo"
    // de audio que el usuario consiguió al desmutar con un gesto; reusándolo
    // con loadVideo(), los clips siguientes mantienen el sonido (un iframe nuevo
    // creado tras el gesto no hereda la activación, así que arrancaría mudo).
    useEffect(() => {
      const p = playerRef.current
      if (!p) return
      if (loadedIdRef.current === videoId) return
      loadedIdRef.current = videoId
      // Nuevo clip: volver a mostrar el poster hasta que arranque a reproducir.
      hasRenderedFrameRef.current = false
      setPosterVisible(true)
      p.loadVideo(Number(videoId))
        .then(() => {
          const iframe = containerRef.current?.querySelector('iframe')
          if (iframe && iframeStyleRef.current) {
            Object.assign(iframe.style, iframeStyleRef.current)
          }
          if (autoplayRef.current) p.play()?.catch(() => {})
          applyMuted(mutedRef.current)
        })
        .catch(() => {})
    }, [videoId])

    // Señal externa para forzar reproducción (ej: el clip se vuelve visible).
    useEffect(() => {
      if (!autoplayRef.current) return
      playerRef.current?.play()?.catch(() => {})
    }, [playSignal])

    useEffect(() => {
      const el = containerRef.current
      if (!el) return

      let cancelled = false
      let player: PlayerType | null = null

      import('@vimeo/player').then(({ default: Player }) => {
        if (cancelled || !el) return

        const startId = videoIdRef.current
        player = new Player(el, {
          id: Number(startId),
          background,
          autoplay,
          loop,
          // Siempre instanciar muteado. Los navegadores bloquean el autoplay CON
          // sonido salvo que haya un gesto reciente, así que crear con
          // `muted: false` congelaba el clip en su primer frame al avanzar el
          // carrusel con sonido. Arrancamos mudo (siempre permitido) y
          // reconciliamos el sonido deseado tras `ready()`.
          muted: true,
          controls,
          autopause,
          title: false,
          byline: false,
          portrait: false,
          dnt: true,
          responsive: false,
        })
        playerRef.current = player
        loadedIdRef.current = startId

        // `play` puede dispararse antes de que Vimeo pinte un frame real. El
        // poster se oculta con `timeupdate` para no mostrar el fondo negro del
        // iframe durante el buffer inicial.
        player.on('play', () => {
          onPlayRef.current?.()
        })
        player.on('timeupdate', (data) => {
          if (hasRenderedFrameRef.current || data.seconds <= 0) return
          hasRenderedFrameRef.current = true
          setPosterVisible(false)
        })

        player
          .ready()
          .then(() => {
            const iframe = el.querySelector('iframe')
            if (iframe && iframeStyleRef.current) {
              Object.assign(iframe.style, iframeStyleRef.current)
            }
            if (title && iframe) iframe.setAttribute('title', title)
            onReadyRef.current?.()
            if (autoplayRef.current) {
              // Garantizar reproducción (autoplay mudo siempre permitido) y
              // luego reconciliar el sonido deseado. Si el desmute lo bloquea
              // la política de autoplay, applyMuted lo traga y el clip sigue
              // reproduciendo mudo en vez de congelarse.
              player?.play()?.catch(() => {})
              applyMuted(mutedRef.current)
            }
          })
          .catch(() => {})
      })

      return () => {
        cancelled = true
        player?.destroy().catch(() => {})
        playerRef.current = null
        loadedIdRef.current = null
      }
      // videoId NO va en deps: los cambios de clip los maneja loadVideo() arriba
      // reusando el mismo iframe. Recrear el player perdería el audio desbloqueado.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoplay, loop, controls, background, autopause, title])

    return (
      <div className={className} style={{ position: 'relative' }}>
        <div ref={containerRef} className="relative z-0 h-full w-full" />
        {poster ? (
          <img
            src={poster}
            alt={title ?? ''}
            aria-hidden
            draggable={false}
            className={`pointer-events-none absolute inset-0 z-10 h-full w-full object-cover transition-opacity duration-500 ${
              posterVisible ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : null}
      </div>
    )
  },
)

export default VimeoPlayer
