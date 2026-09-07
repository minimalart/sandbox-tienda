import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import type { FiscalSnapshot } from './types';

/** Etiquetas legibles de la condición IVA para el PDF. */
const TAX_CONDITION_LABELS: Record<string, string> = {
  responsable_inscripto: 'Responsable Inscripto',
  exento: 'Exento',
  monotributo: 'Monotributo',
  consumidor_final: 'Consumidor Final',
};

export type ConstanciaPdfInput = {
  snapshot: FiscalSnapshot;
  /** Nombre de la empresa dueña (corporate/company). */
  ownerName: string;
  /** Momento de generación del documento. */
  generatedAt: Date;
  /** Marca institucional del encabezado. Default "Mercatto". */
  brandName?: string;
  /** Logo opcional (PNG) para el encabezado. */
  logoPng?: Buffer | Uint8Array;
  /** Pie institucional configurable. */
  footer?: string;
};

/** StandardFonts solo codifican WinAnsi (Latin-1); descartamos lo que no entra. */
function sanitize(text: string): string {
  let out = '';
  for (const ch of text) {
    out += ch.charCodeAt(0) <= 255 ? ch : '?';
  }
  return out;
}

const DEFAULT_FOOTER =
  'Documento generado automáticamente a partir de información obtenida desde ARCA.';

function formatDate(d: Date): string {
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Genera el PDF de la constancia de situación fiscal como Buffer.
 * Usa fuentes estándar embebidas (sin lecturas de disco en runtime).
 */
export async function generateConstanciaPdf(input: ConstanciaPdfInput): Promise<Buffer> {
  const { snapshot, ownerName, generatedAt } = input;
  const brandName = input.brandName || 'Mercatto';
  const footer = input.footer || DEFAULT_FOOTER;

  const doc = await PDFDocument.create();
  doc.setTitle('Constancia de Situación Fiscal');
  doc.setCreator(brandName);
  doc.setProducer(brandName);

  const page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 56;
  const ink = rgb(0.1, 0.1, 0.12);
  const muted = rgb(0.42, 0.44, 0.5);
  const line = rgb(0.85, 0.86, 0.9);
  let y = height - margin;

  const draw = (
    text: string,
    x: number,
    yy: number,
    f: PDFFont,
    size: number,
    color = ink,
  ): void => {
    page.drawText(sanitize(text), { x, y: yy, size, font: f, color });
  };

  // ---- Encabezado ---------------------------------------------------------
  if (input.logoPng) {
    try {
      const img = await doc.embedPng(input.logoPng);
      const scaled = img.scaleToFit(120, 40);
      page.drawImage(img, { x: margin, y: y - scaled.height + 8, width: scaled.width, height: scaled.height });
    } catch {
      draw(brandName, margin, y - 6, bold, 20);
    }
  } else {
    draw(brandName, margin, y - 6, bold, 20);
  }
  draw('Constancia de Situación Fiscal', margin, y - 34, font, 13, muted);
  y -= 62;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: line });
  y -= 34;

  // ---- Datos --------------------------------------------------------------
  const labelX = margin;
  const valueX = margin + 150;
  const valueWidth = width - margin - valueX;
  const rowGap = 26;

  const wrap = (text: string, size: number): string[] => {
    const words = sanitize(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';
    for (const w of words) {
      const candidate = current ? `${current} ${w}` : w;
      if (font.widthOfTextAtSize(candidate, size) > valueWidth && current) {
        lines.push(current);
        current = w;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  };

  const row = (label: string, value: string): void => {
    draw(label, labelX, y, bold, 11, muted);
    const lines = wrap(value || '—', 11);
    lines.forEach((ln, i) => draw(ln, valueX, y - i * 14, font, 11));
    y -= rowGap + (lines.length - 1) * 14;
  };

  const addr = snapshot.address;
  const fullAddress = [addr.address_line_1, addr.city, addr.province, addr.postal_code]
    .filter(Boolean)
    .join(', ');

  row('Razón Social', snapshot.legal_name);
  row('CUIT', snapshot.tax_id);
  row('Condición IVA', TAX_CONDITION_LABELS[snapshot.tax_condition] ?? snapshot.tax_condition);
  row('Estado', snapshot.status);
  row('Empresa', ownerName);
  row('Domicilio', fullAddress);
  row('Actividad principal', snapshot.activities[0] ?? '—');
  row('Fecha de consulta', `${formatDate(generatedAt)} ${formatTime(generatedAt)} hs`);

  // ---- Pie ----------------------------------------------------------------
  const footerY = margin + 48;
  page.drawLine({
    start: { x: margin, y: footerY + 24 },
    end: { x: width - margin, y: footerY + 24 },
    thickness: 1,
    color: line,
  });
  const footerLines = wrap(footer, 9);
  footerLines.forEach((ln, i) => draw(ln, margin, footerY + 6 - i * 12, font, 9, muted));
  draw(
    `Consulta: ${formatDate(generatedAt)} — ${formatTime(generatedAt)} hs`,
    margin,
    footerY - 6 - footerLines.length * 12,
    font,
    9,
    muted,
  );

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

export { TAX_CONDITION_LABELS };
