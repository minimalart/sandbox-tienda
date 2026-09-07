"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildBannerCopyMessages = buildBannerCopyMessages;
exports.buildBannerImagePrompt = buildBannerImagePrompt;
const COPY_SYSTEM = `Sos un redactor publicitario de ecommerce. Generás el copy de un BANNER breve y vendedor.
Reglas estrictas:
- Respondé EXCLUSIVAMENTE JSON válido. Nada de Markdown, HTML ni comentarios.
- Forma EXACTA: {"content":{"title":"","subtitle":"","body":""},"cta":{"label":"","url":""}}
- title: gancho de 2 a 6 palabras. subtitle: una línea de apoyo. body: opcional y muy corto (o "").
- cta.label: 1 a 3 palabras (ej: "Ver ofertas"). cta.url: ruta relativa del storefront (ej: "/store", "/store?promos=1"); NUNCA inventes dominios ni uses http(s) externos.
- Si te pasan PRODUCTOS, el copy debe destacarlos usando sus nombres reales; no inventes productos ni características que no estén en el contexto.
- Escribí en el idioma del "locale" (por defecto es-AR). Sin emojis salvo que el tono lo pida.`;
/** Mensajes para generar el copy (title/subtitle/body + CTA) de un banner. */
function buildBannerCopyMessages(input) {
    const products = (input.products ?? []).filter((p) => p.title?.trim());
    const productLines = products.length
        ? [
            'Productos a destacar (usá sus nombres reales):',
            ...products.map((p) => p.description?.trim()
                ? `- ${p.title} — ${p.description.trim().slice(0, 160)}`
                : `- ${p.title}`),
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
function buildBannerImagePrompt(input) {
    const noText = 'IMAGEN SIN NINGÚN TEXTO. Está prohibido renderizar texto, palabras, letras, números, títulos, logos, marcas o marcas de agua.';
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2Jhbm5lci9haS9wcm9tcHRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBNkJBLDBEQXlCQztBQVNELHdEQTBDQztBQXRGRCxNQUFNLFdBQVcsR0FBRzs7Ozs7OzsrRkFPMkUsQ0FBQztBQUVoRyw4RUFBOEU7QUFDOUUsU0FBZ0IsdUJBQXVCLENBQUMsS0FBOEI7SUFDcEUsTUFBTSxRQUFRLEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxJQUFJLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQ3ZFLE1BQU0sWUFBWSxHQUFHLFFBQVEsQ0FBQyxNQUFNO1FBQ2xDLENBQUMsQ0FBQztZQUNFLGdEQUFnRDtZQUNoRCxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUNwQixDQUFDLENBQUMsV0FBVyxFQUFFLElBQUksRUFBRTtnQkFDbkIsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssTUFBTSxDQUFDLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLEVBQUU7Z0JBQ3hELENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FDbkI7U0FDRjtRQUNILENBQUMsQ0FBQyxFQUFFLENBQUM7SUFDUCxNQUFNLEtBQUssR0FBRztRQUNaLFVBQVUsS0FBSyxDQUFDLEtBQUssRUFBRTtRQUN2QixLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxhQUFhLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRTtRQUMzQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRTtRQUN2QyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxjQUFjLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRTtRQUNwRCxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyx5QkFBeUIsS0FBSyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFO1FBQ2pFLEdBQUcsWUFBWTtRQUNmLFdBQVcsS0FBSyxDQUFDLE1BQU0sSUFBSSxPQUFPLEVBQUU7S0FDckMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDbEIsT0FBTztRQUNMLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFO1FBQ3hDLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRTtLQUM1QyxDQUFDO0FBQ0osQ0FBQztBQUVEOzs7Ozs7R0FNRztBQUNILFNBQWdCLHNCQUFzQixDQUFDLEtBTXRDO0lBQ0MsTUFBTSxNQUFNLEdBQ1YsK0hBQStILENBQUM7SUFFbEksSUFBSSxLQUFLLENBQUMsZUFBZSxFQUFFLENBQUM7UUFDMUIsTUFBTSxLQUFLLEdBQUcsQ0FBQyxLQUFLLENBQUMsYUFBYSxJQUFJLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUMxRCxPQUFPO1lBQ0wsTUFBTTtZQUNOLHFJQUFxSTtZQUNySSw0T0FBNE87WUFDNU8sMEtBQTBLO1lBQzFLLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLGNBQWMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQ3JELGtCQUFrQixLQUFLLENBQUMsS0FBSyxHQUFHO1lBQ2hDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFdBQVcsS0FBSyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQ3BELDRFQUE0RTtZQUM1RSwwRUFBMEU7WUFDMUUsbU1BQW1NO1lBQ25NLE1BQU07U0FDUDthQUNFLE1BQU0sQ0FBQyxPQUFPLENBQUM7YUFDZixJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDZixDQUFDO0lBRUQsT0FBTztRQUNMLE1BQU07UUFDTixpSEFBaUg7UUFDakgseUVBQXlFO1FBQ3pFLHlFQUF5RTtRQUN6RSxtSkFBbUo7UUFDbkosU0FBUyxLQUFLLENBQUMsS0FBSyxHQUFHO1FBQ3ZCLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLG9EQUFvRCxLQUFLLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUU7UUFDckYsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsV0FBVyxLQUFLLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUU7UUFDcEQsTUFBTTtLQUNQO1NBQ0UsTUFBTSxDQUFDLE9BQU8sQ0FBQztTQUNmLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNmLENBQUMifQ==