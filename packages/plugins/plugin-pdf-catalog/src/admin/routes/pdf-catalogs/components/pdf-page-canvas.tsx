import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Worker de pdf.js resuelto por Vite (bundler del admin de Medusa).
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface Props {
  /** URL pública del PDF (o data URL). */
  fileUrl: string;
  /** Página actual (0-based). */
  pageIndex: number;
  /** Ancho de render en px. */
  width?: number;
  /** Notifica el total de páginas al cargar el documento. */
  onNumPages?: (pages: number) => void;
  /** Click sobre la página → coords en porcentaje (0–100). */
  onPageClick?: (x: number, y: number) => void;
  /** Overlay de hotspots renderizado sobre la página. */
  children?: React.ReactNode;
  /** Cursor crosshair cuando hay una herramienta armada. */
  placing?: boolean;
  /** Reenvía eventos de puntero (para drag de hotspots). */
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: () => void;
  wrapRef?: React.RefObject<HTMLDivElement | null>;
}

export function PdfPageCanvas({
  fileUrl,
  pageIndex,
  width = 560,
  onNumPages,
  onPageClick,
  children,
  placing,
  onPointerMove,
  onPointerUp,
  wrapRef,
}: Props) {
  const innerRef = useRef<HTMLDivElement>(null);
  const ref = wrapRef ?? innerRef;
  const [numPages, setNumPages] = useState(0);

  const file = useMemo(() => fileUrl, [fileUrl]);

  const onLoad = useCallback(
    ({ numPages: total }: { numPages: number }) => {
      setNumPages(total);
      onNumPages?.(total);
    },
    [onNumPages]
  );

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onPageClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = Math.min(100, Math.max(0, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
    const y = Math.min(100, Math.max(0, Math.round(((e.clientY - rect.top) / rect.height) * 100)));
    onPageClick(x, y);
  };

  useEffect(() => {
    setNumPages(0);
  }, [fileUrl]);

  return (
    <Document
      file={file}
      onLoadSuccess={onLoad}
      loading={
        <div className="flex items-center justify-center p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ui-fg-interactive" />
        </div>
      }
      error={
        <div className="flex items-center justify-center p-12 text-ui-fg-error">
          No se pudo cargar el PDF
        </div>
      }
    >
      <div
        ref={ref}
        onClick={handleClick}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        className={`relative touch-none overflow-hidden rounded-lg border border-ui-border-base shadow-sm ${
          placing ? 'cursor-crosshair' : ''
        }`}
      >
        {numPages > 0 && (
          <Page
            pageNumber={Math.min(pageIndex + 1, numPages)}
            width={width}
            renderAnnotationLayer={false}
            renderTextLayer={false}
          />
        )}
        {children}
      </div>
    </Document>
  );
}
