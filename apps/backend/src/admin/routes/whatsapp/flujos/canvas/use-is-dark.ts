import { useEffect, useState } from 'react';

/**
 * El admin de Medusa marca el tema con la clase `dark` en el `<html>` — es lo que
 * lee su propio dashboard (`documentElement.classList.contains("dark")`).
 *
 * Se observa con un `MutationObserver` y no se lee una sola vez al montar porque el
 * usuario puede cambiar el tema con el editor abierto, y un canvas que se queda en
 * el modo anterior queda ilegible sobre el fondo nuevo.
 */
export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const read = () => setIsDark(root.classList.contains('dark'));
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
