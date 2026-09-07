import { createHash } from 'node:crypto';

/**
 * Extracción de texto de documentos cargados como contexto de un agente. PDF vía
 * `unpdf` (pdf.js serverless, ESM puro, sin binarios nativos → seguro en DO App
 * Platform); txt/md por decode utf8 directo.
 *
 * `unpdf` es ESM puro y el backend transpila a CJS, así que se carga con el mismo
 * `dynamicImport` que usa `api/mcp/_loader.ts` (un `import()` que SWC no degrada a
 * `require`), evitando `ERR_REQUIRE_ESM`.
 */

const dynamicImport = new Function('s', 'return import(s)') as (s: string) => Promise<any>;

export const ACCEPTED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
] as const;

export function isSupportedDocumentMime(mime: string): boolean {
  return (ACCEPTED_DOCUMENT_MIME_TYPES as readonly string[]).includes(mime);
}

export class UnsupportedDocumentError extends Error {
  status = 400;
}

/** SHA-256 hex del texto extraído (dedup + detectar cambios para re-chunk). */
export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Extrae el texto de un documento. Devuelve string (puede ser vacío si el PDF no
 * tiene capa de texto, p. ej. escaneado: el caller marca el doc como `failed`).
 */
export async function extractDocumentText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    const { extractText, getDocumentProxy } = await dynamicImport('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    const joined = Array.isArray(text) ? text.join('\n\n') : String(text ?? '');
    return joined.trim();
  }
  if (
    mimeType === 'text/plain' ||
    mimeType === 'text/markdown' ||
    mimeType === 'text/x-markdown'
  ) {
    return buffer.toString('utf8').trim();
  }
  throw new UnsupportedDocumentError(`Tipo de archivo no soportado: ${mimeType}`);
}
