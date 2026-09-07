/**
 * Parseo y validación PURA de la data maestra tintométrica que se importa.
 *
 * La carta de colores y la lista de fórmulas vienen en planilla del fabricante
 * (Zeus no expone ninguna de las dos), así que el import acepta CSV o JSON y su
 * trabajo más importante es RECHAZAR filas malas informando cuál y por qué: una
 * fórmula mal cargada no se nota hasta que un cliente elige ese color y el ERP
 * contesta "no existe".
 *
 * Nada de esto toca la base: devuelve filas normalizadas + errores, y el service
 * decide qué escribir. Así el `dry_run` del endpoint es exactamente el mismo
 * código que la corrida real.
 */

import type { ColorImage } from './color-images';
import { normalizeColorImages, parseColorImagesCell } from './color-images';

export type TintingImportKind = 'colors' | 'formulas' | 'bases';

export type ColorImportRow = {
  code: string;
  name: string;
  collection: string;
  hex: string | null;
  family: string | null;
  group_key: string | null;
  rank: number;
  /**
   * Fotos de ambiente. `null` = la planilla no trae la columna (no tocar las que
   * ya estén guardadas); `[]` = la trae vacía (borrarlas). La distinción importa:
   * la carta y las fotos se cargan en corridas separadas.
   */
  images: ColorImage[] | null;
};

export type FormulaImportRow = {
  color_code: string;
  collection: string;
  product_line: string;
  base_letter: string | null;
  zeus_formula_code: string;
  base_article_code: string | null;
};

export type BaseImportRow = {
  article_code: string;
  base_letter: string | null;
  product_line: string;
  collection: string | null;
  size_label: string | null;
  size_liters: number | null;
  /**
   * El artículo también se vende sin entonar. `undefined` = la planilla no trae
   * la columna, y entonces el upsert no toca lo que ya esté guardado: es una
   * decisión humana, no un dato del ERP.
   */
  sellable_untinted?: boolean;
};

export type ImportRowError = {
  /** Número de fila del archivo (1 = primera fila de datos, sin contar el header). */
  row: number;
  reason: string;
};

export type ParsedImport<T> = {
  rows: T[];
  errors: ImportRowError[];
};

/**
 * CSV mínimo pero correcto: soporta `,` y `;` como separador (Excel en es-AR
 * exporta con `;`), comillas dobles con `""` escapado y CRLF. No usamos una
 * librería para no agregar una dependencia al backend por un import manual.
 */
export function parseCsv(text: string): Array<Record<string, string>> {
  const clean = text.replace(/^﻿/, '');
  const lines = splitCsvLines(clean).filter((line) => line.trim() !== '');
  if (!lines.length) return [];

  const delimiter = detectDelimiter(lines[0] as string);
  const header = splitCsvLine(lines[0] as string, delimiter).map((h) =>
    h.trim().toLowerCase().replace(/\s+/g, '_')
  );

  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line, delimiter);
    const row: Record<string, string> = {};
    header.forEach((key, index) => {
      if (key) row[key] = (cells[index] ?? '').trim();
    });
    return row;
  });
}

function detectDelimiter(headerLine: string): ',' | ';' {
  const semis = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return semis > commas ? ';' : ',';
}

/**
 * Corta por líneas respetando los saltos que estén DENTRO de comillas (un nombre
 * de color con salto de línea rompería el conteo de filas). Las comillas se
 * dejan en la línea: las resuelve `splitCsvLine`.
 */
function splitCsvLines(text: string): string[] {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] as string;

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        // Comilla escapada: se copia el par y no cambia el estado.
        current += '""';
        i += 1;
      } else {
        inQuotes = !inQuotes;
        current += '"';
      }
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      lines.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  if (current !== '') lines.push(current);
  return lines;
}

function splitCsvLine(line: string, delimiter: ',' | ';'): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i] as string;
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

const str = (row: Record<string, unknown>, ...keys: string[]): string => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
};

const nullable = (row: Record<string, unknown>, ...keys: string[]): string | null =>
  str(row, ...keys) || null;

/** `#RRGGBB` normalizado, o `null`. Un hex inválido NO invalida el color: va sin swatch. */
function normalizeHex(raw: string): string | null {
  if (!raw) return null;
  const hex = raw.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    const [r, g, b] = hex.split('') as [string, string, string];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex.toUpperCase()}`;
  return null;
}

const IMAGE_KEYS = ['images', 'imagenes', 'imágenes', 'fotos'] as const;

/**
 * Fotos de la fila, distinguiendo "la planilla no trae la columna" (`null`) de
 * "la trae vacía" (`[]`): lo primero conserva las fotos ya guardadas, lo segundo
 * las borra. Sin esa diferencia, reimportar la carta desde la planilla del
 * fabricante —que nunca tuvo fotos— borraría el harvest.
 *
 * Por CSV llega como texto; por `rows` JSON llega como array u objeto.
 */
function colorImages(raw: Record<string, unknown>): ColorImage[] | null {
  for (const key of IMAGE_KEYS) {
    const value = raw[key];
    if (value === undefined || value === null) continue;
    if (typeof value === 'string') return parseColorImagesCell(value);
    return normalizeColorImages(value);
  }
  return null;
}

function toNumber(raw: string): number | null {
  if (!raw) return null;
  const num = Number(raw.replace(',', '.'));
  return Number.isFinite(num) ? num : null;
}

/**
 * Booleano de planilla. Devuelve `undefined` cuando la celda está VACÍA, que no
 * es lo mismo que `false`: sin columna el upsert deja el valor guardado como
 * está, y con la columna en `0` lo apaga.
 *
 * Acepta las formas que escribe Excel en es-AR además de las de JSON.
 */
function toBoolean(row: Record<string, unknown>, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value !== 0;
    if (typeof value === 'string' && value.trim()) {
      const text = value.trim().toLowerCase();
      if (['1', 'true', 'si', 'sí', 'x', 'y', 'yes'].includes(text)) return true;
      if (['0', 'false', 'no', 'n'].includes(text)) return false;
    }
  }
  return undefined;
}

export function parseColorRows(input: Array<Record<string, unknown>>): ParsedImport<ColorImportRow> {
  const rows: ColorImportRow[] = [];
  const errors: ImportRowError[] = [];
  const seen = new Set<string>();

  input.forEach((raw, index) => {
    const row = index + 1;
    const code = str(raw, 'code', 'codigo', 'color_code');
    const name = str(raw, 'name', 'nombre');
    const collection = str(raw, 'collection', 'carta', 'coleccion');

    if (!code) return void errors.push({ row, reason: 'Falta el código del color.' });
    if (!name) return void errors.push({ row, reason: `Falta el nombre del color ${code}.` });
    if (!collection) {
      return void errors.push({
        row,
        reason: `Falta la carta del color ${code}. La fórmula es por carta, así que el color sin carta no se puede cotizar.`,
      });
    }

    const key = `${collection}::${code}`.toLowerCase();
    if (seen.has(key)) {
      return void errors.push({ row, reason: `El color ${code} está repetido en la carta ${collection}.` });
    }
    seen.add(key);

    rows.push({
      code,
      name,
      collection,
      hex: normalizeHex(str(raw, 'hex', 'color_hex', 'rgb')),
      family: nullable(raw, 'family', 'familia'),
      group_key: nullable(raw, 'group_key', 'grupo'),
      rank: toNumber(str(raw, 'rank', 'orden')) ?? 0,
      images: colorImages(raw),
    });
  });

  return { rows, errors };
}

export function parseFormulaRows(
  input: Array<Record<string, unknown>>
): ParsedImport<FormulaImportRow> {
  const rows: FormulaImportRow[] = [];
  const errors: ImportRowError[] = [];
  const seen = new Set<string>();

  input.forEach((raw, index) => {
    const row = index + 1;
    const colorCode = str(raw, 'color_code', 'color', 'codigo_color');
    const collection = str(raw, 'collection', 'carta', 'coleccion');
    const productLine = str(raw, 'product_line', 'linea', 'línea');
    const formulaCode = str(raw, 'zeus_formula_code', 'formula', 'codigo_formula', 'cod_formula');

    if (!colorCode) return void errors.push({ row, reason: 'Falta el código de color.' });
    if (!collection) return void errors.push({ row, reason: `Falta la carta (color ${colorCode}).` });
    if (!productLine) {
      return void errors.push({ row, reason: `Falta la línea de producto (color ${colorCode}).` });
    }
    if (!formulaCode) {
      return void errors.push({
        row,
        reason: `Falta el código de fórmula (color ${colorCode}). Es el único dato que Zeus necesita para cotizar.`,
      });
    }

    const baseLetter = nullable(raw, 'base_letter', 'letra', 'base');
    const key = `${colorCode}::${collection}::${productLine}::${baseLetter ?? ''}`.toLowerCase();
    if (seen.has(key)) {
      return void errors.push({
        row,
        reason: `Fórmula repetida para ${colorCode} en ${productLine} base ${baseLetter ?? 'única'}.`,
      });
    }
    seen.add(key);

    rows.push({
      color_code: colorCode,
      collection,
      product_line: productLine,
      base_letter: baseLetter ? baseLetter.toUpperCase() : null,
      // Se guarda TAL CUAL viene (Gestión lo muestra con espacio): la
      // normalización a lo que acepta la API la hace `formula-code.ts`.
      zeus_formula_code: formulaCode,
      base_article_code: nullable(raw, 'base_article_code', 'codigo_articulo', 'articulo'),
    });
  });

  return { rows, errors };
}

export function parseBaseRows(input: Array<Record<string, unknown>>): ParsedImport<BaseImportRow> {
  const rows: BaseImportRow[] = [];
  const errors: ImportRowError[] = [];
  const seen = new Set<string>();

  input.forEach((raw, index) => {
    const row = index + 1;
    const articleCode = str(raw, 'article_code', 'codigo', 'sku');
    const productLine = str(raw, 'product_line', 'linea', 'línea');

    if (!articleCode) return void errors.push({ row, reason: 'Falta el código de artículo.' });
    if (!productLine) {
      return void errors.push({ row, reason: `Falta la línea de producto (artículo ${articleCode}).` });
    }
    if (seen.has(articleCode.toLowerCase())) {
      return void errors.push({ row, reason: `El artículo ${articleCode} está repetido.` });
    }
    seen.add(articleCode.toLowerCase());

    const letter = nullable(raw, 'base_letter', 'letra');
    const sellableUntinted = toBoolean(
      raw,
      'sellable_untinted',
      'vendible_sin_entonar',
      'se_vende_sin_entonar'
    );
    rows.push({
      article_code: articleCode,
      base_letter: letter ? letter.toUpperCase() : null,
      product_line: productLine,
      collection: nullable(raw, 'collection', 'carta', 'coleccion'),
      size_label: nullable(raw, 'size_label', 'envase', 'tamanio', 'tamaño'),
      size_liters: toNumber(str(raw, 'size_liters', 'litros')),
      // Sólo va la clave si la planilla la trae: `undefined` en el upsert es
      // "no tocar", y mandar `false` por omisión desmarcaría bases ya cargadas.
      ...(sellableUntinted === undefined ? {} : { sellable_untinted: sellableUntinted }),
    });
  });

  return { rows, errors };
}

/** Filas crudas desde el body del endpoint: JSON directo o texto CSV. */
export function readRawRows(payload: {
  rows?: unknown;
  csv?: unknown;
}): Array<Record<string, unknown>> {
  if (typeof payload.csv === 'string' && payload.csv.trim()) {
    return parseCsv(payload.csv);
  }
  if (Array.isArray(payload.rows)) {
    return payload.rows.filter(
      (row): row is Record<string, unknown> =>
        typeof row === 'object' && row !== null && !Array.isArray(row)
    );
  }
  return [];
}
