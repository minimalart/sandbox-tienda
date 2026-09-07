import type { ChatMessage } from '../../../lib/landing-ai/client';

/** Producto usado como contexto para el copy (nombre real + descripción corta). */
export type BannerProductContext = {
  title: string;
  description?: string;
};

export type GenerateBannerCopyInput = {
  brief: string;
  tone?: string;
  goal?: string;
  audience?: string;
  locale?: string;
  placement?: string;
  /** Productos elegidos por el usuario; el copy debe girar en torno a ellos. */
  products?: BannerProductContext[];
};

const COPY_SYSTEM = `Sos un redactor publicitario de ecommerce. Generás el copy de un BANNER breve y vendedor.
Reglas estrictas:
- Respondé EXCLUSIVAMENTE JSON válido. Nada de Markdown, HTML ni comentarios.
- Forma EXACTA: {"content":{"title":"","subtitle":"","body":""},"cta":{"label":"","url":""}}
- title: gancho de 2 a 6 palabras. subtitle: una línea de apoyo. body: opcional y muy corto (o "").
- cta.label: 1 a 3 palabras (ej: "Ver ofertas"). cta.url: ruta relativa del storefront (ej: "/store", "/store?promos=1"); NUNCA inventes dominios ni uses http(s) externos.
- Si te pasan PRODUCTOS, el copy debe destacarlos usando sus nombres reales; no inventes productos ni características que no estén en el contexto.
- Escribí en el idioma del "locale" (por defecto es-AR). Sin emojis salvo que el tono lo pida.`;

/** Mensajes para generar el copy (title/subtitle/body + CTA) de un banner. */
export function buildBannerCopyMessages(input: GenerateBannerCopyInput): ChatMessage[] {
  const products = (input.products ?? []).filter((p) => p.title?.trim());
  const productLines = products.length
    ? [
        'Productos a destacar (usá sus nombres reales):',
        ...products.map((p) =>
          p.description?.trim()
            ? `- ${p.title} — ${p.description.trim().slice(0, 160)}`
            : `- ${p.title}`,
        ),
      ]
    : [];
  const lines = [
    `Brief: ${input.brief}`,
    input.goal ? `Objetivo: ${input.goal}` : '',
    input.tone ? `Tono: ${input.tone}` : '',
    input.audience ? `Audiencia: ${input.audience}` : '',
    input.placement ? `Ubicación del banner: ${input.placement}` : '',
    ...productLines,
    `Locale: ${input.locale || 'es-AR'}`,
  ].filter(Boolean);
  return [
    { role: 'system', content: COPY_SYSTEM },
    { role: 'user', content: lines.join('\n') },
  ];
}

/**
 * Prompt para la imagen del banner. Igual que en landings, prohíbe texto en la
 * imagen (el copy va superpuesto por el front) y pide zonas de tono parejo.
 * Si se pasan productos con imágenes de referencia (`withProductRefs`), instruye
 * al modelo a componer la escena manteniendo cada producto FIEL a su foto (sin
 * deformarlo ni cambiar su diseño/packaging).
 */
export function buildBannerImagePrompt(input: {
  brief: string;
  title?: string;
  styleHint?: string;
  productTitles?: string[];
  withProductRefs?: boolean;
}): string {
  const noText =
    'IMAGEN SIN NINGÚN TEXTO. Está prohibido renderizar texto, palabras, letras, números, títulos, logos, marcas o marcas de agua.';

  if (input.withProductRefs) {
    const names = (input.productTitles ?? []).filter(Boolean);
    return [
      noText,
      'Componé una imagen de banner de ecommerce HORIZONTAL y de alta calidad usando los PRODUCTOS de las imágenes de referencia adjuntas.',
      'CRÍTICO: cada producto debe quedar FIEL a su foto de referencia — misma forma, color, etiqueta, packaging y proporciones. NO lo deformes, no lo recortes raro, no cambies su diseño ni inventes variantes. Reproducí el producto tal cual.',
      'Integrá los productos de forma natural en una escena atractiva y coherente (fondo, superficie, iluminación y sombras realistas), como una foto publicitaria profesional.',
      names.length ? `Productos: ${names.join(', ')}.` : '',
      `Tema/contexto: ${input.brief}.`,
      input.styleHint ? `Estilo: ${input.styleHint}.` : '',
      // El texto del banner va SIEMPRE alineado a la izquierda; por eso el motivo
      // va a la derecha y la izquierda queda despejada para superponer el copy.
      'COMPOSICIÓN: ubicá los productos hacia la MITAD DERECHA del cuadro; dejá el TERCIO IZQUIERDO despejado, de tono parejo y más bien oscuro (ahí se superpone el texto). Formato panorámico y ancho.',
      noText,
    ]
      .filter(Boolean)
      .join(' ');
  }

  return [
    noText,
    'Imagen para un banner de ecommerce: horizontal panorámica, alta calidad, fotográfica o ilustrada según el tema.',
    // El texto va a la izquierda: componer el motivo a la derecha y dejar la
    // izquierda despejada/oscura para superponer el copy con buen contraste.
    'COMPOSICIÓN: motivo principal hacia la MITAD DERECHA; TERCIO IZQUIERDO despejado, de tono parejo y más bien oscuro para superponer texto legible.',
    `Tema: ${input.brief}.`,
    input.title ? `Contexto del mensaje (NO escribir en la imagen): ${input.title}.` : '',
    input.styleHint ? `Estilo: ${input.styleHint}.` : '',
    noText,
  ]
    .filter(Boolean)
    .join(' ');
}
