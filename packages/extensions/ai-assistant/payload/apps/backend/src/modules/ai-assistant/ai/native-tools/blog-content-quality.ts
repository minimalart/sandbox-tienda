export const MIN_GENERATED_BLOG_TEXT_LENGTH = 250;

export type BlogContentValidation = {
  ok: boolean;
  plainTextLength: number;
  message?: string;
};

export function plainTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Elimina una sección "Fuentes" que quedó VACÍA (sin enlaces reales). Cuando el
 * investigador corre sin búsqueda web devuelve source_urls:[], y el redactor a veces
 * agrega igual el <h2>Fuentes</h2> con un bullet vacío. Esta limpieza determinística
 * garantiza que no quede una sección "Fuentes" con un punto vacío: si la lista que
 * sigue al encabezado no tiene ningún <a href>, se saca el encabezado y la lista.
 * Si SÍ hay enlaces, la sección es válida y se conserva intacta.
 */
export function stripEmptySourcesSection(html: string): string {
  const re = /<(h[1-6])[^>]*>\s*fuentes?\s*<\/\1>\s*(<(?:ul|ol)[^>]*>[\s\S]*?<\/(?:ul|ol)>)?/gi;
  return html
    .replace(re, (match, _tag, list) => (list && /<a\s[^>]*href=/i.test(list) ? match : ''))
    .trim();
}

export function validateGeneratedBlogContentHtml(html: string): BlogContentValidation {
  const plainText = plainTextFromHtml(html);
  if (plainText.length >= MIN_GENERATED_BLOG_TEXT_LENGTH) {
    return { ok: true, plainTextLength: plainText.length };
  }

  return {
    ok: false,
    plainTextLength: plainText.length,
    message:
      'Error: el contenido es demasiado corto para publicarse (parece solo un titulo o un parrafo). Reescribi content_html COMPLETO: intro + secciones reales (para una receta: <h2>Ingredientes</h2><ul>...</ul> y <h2>Preparacion</h2><ol>...</ol>), varios cientos de palabras. NO devuelvas solo un titulo y una oracion. Despues volve a llamar la tool con el contenido completo.',
  };
}
