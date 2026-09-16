import { useEffect, useRef, useState } from 'react';

/**
 * LLENAR HASTA EL FONDO DE LA VENTANA, EXACTO.
 *
 * El alto era `calc(100vh - 57px)`, con el 57 escrito a mano: la barra del admin. No
 * da exacto —cambia con el breadcrumb, con el breakpoint y con el padding que el
 * shell le pone al contenido de la ruta— y lo que sobra aparece como unos pocos
 * píxeles de scroll vertical en TODA la página. En un editor de canvas eso es peor
 * que feo: la rueda del mouse cerca de un borde mueve la página en vez del diagrama.
 *
 * Medir el `top` real del contenedor y restar no depende de ningún número mágico, así
 * que sigue dando bien aunque el admin cambie de alto. Es el mismo criterio que ya usa
 * el inbox de esta extensión para su iframe.
 */
export function useFillHeight(min = 420): {
  ref: React.RefObject<HTMLDivElement>;
  height: number | undefined;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      // El 16 es el respiro de abajo: sin él la pantalla termina pegada al borde y
      // vuelve a aparecer el scroll por el padding del shell.
      setHeight(Math.max(min, Math.floor(window.innerHeight - top - 16)));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [min]);

  return { ref, height };
}
