import type { WorkflowDefinitionData } from '../workflow-engine';
import { CAMPAIGN_WORKFLOW_DEFINITION } from './campaign';

export const RECIPE_WORKFLOW_DEFINITION: WorkflowDefinitionData = {
  key: 'receta',
  name: 'Receta para el blog',
  description:
    'Crea un borrador de receta en el blog: investiga, redacta el artículo, genera la portada y vincula productos del catálogo como ingredientes.',
  steps: [
    {
      key: 'investigar',
      agent_key: 'investigador',
      label: 'Buscar la receta en internet',
      task: 'Investigá en internet una receta de "{{input.topic}}" usando tus tools de búsqueda (Tavily/Firecrawl). Hacé al menos 2 búsquedas y consultá varias páginas. Reuní: (a) la lista COMPLETA de ingredientes con sus nombres GENÉRICOS y cantidades (si el plato lleva carne vacuna, indicá el/los CORTE(S) argentino(s) concreto(s) y adecuado(s) —p. ej. peceto, cuadrada, colita de cuadril—, no el genérico "carne"), (b) los PASOS de preparación en orden, y (c) TODAS las URLs fuente que abriste. No copies texto creativo de las páginas: pasá hechos. EN TU MENSAJE escribí SOLO 1 oración breve de qué encontraste (no pegues la lista). Los DATOS van únicamente en el bloque final, que es OBLIGATORIO y debe traer ingredients con al menos 4 entradas y steps con al menos 3: <result>{"ingredients":["…","…","…","…"],"steps":["…","…","…"],"source_urls":["…","…"]}</result>. Si NO tenés búsqueda web disponible (no ves tools de Tavily/Firecrawl), igual completá ingredients y steps con tu mejor conocimiento del plato (NUNCA vacío) y agregá note:"sin búsqueda web": <result>{"ingredients":["…"],"steps":["…"],"source_urls":[],"note":"sin búsqueda web"}</result>.',
    },
    {
      key: 'redactar',
      agent_key: 'redactor',
      label: 'Redactar el artículo y crear el borrador',
      task: 'Escribí un artículo de RECETA original y COMPLETO sobre "{{input.topic}}" en content_html (HTML simple: h2/h3/p/ul/ol/li/strong/em/a). Escribí TODO en español argentino (voseo: cociná/dorá/poné; papa no "patata", carne vacuna no "carne de res"; cocción: asar/hornear/dorar/sellar, NUNCA "rostizar"). Si lleva carne vacuna, usá un CORTE argentino concreto (p. ej. peceto, cuadrada, colita de cuadril, bola de lomo) —nunca el genérico "carne"— y mencioná 1-2 cortes alternativos. Estructura OBLIGATORIA, en este orden: (1) 1-2 párrafos <p> de introducción; (2) <h2>Ingredientes</h2> seguido de un <ul> con un <li> por CADA ingrediente (con su cantidad); (3) <h2>Preparación</h2> seguido de un <ol> con un <li> por CADA paso, redactado con TUS palabras; (4) opcional <h2>Consejos</h2> con 1-2 tips. Usá como INSUMO (sin copiar textos) los datos de investigación: {{state.investigar}}. Al FINAL del content_html, SOLO si hay URLs REALES en {{state.investigar.source_urls}}, agregá <h2>Fuentes</h2> seguido de un <ul> con un <li><a href="URL">URL</a></li> por cada URL. Si source_urls está vacío o es [], NO escribas la sección Fuentes: ni el <h2>Fuentes</h2> ni bullets vacíos. El artículo debe tener CUERPO REAL (varios cientos de palabras): NUNCA devuelvas solo un título y un párrafo. "Escribí 1 oración breve" aplica SOLO a tu mensaje de chat, NUNCA al content_html. Creá el BORRADOR con create_blog_post (status draft, title = nombre del plato, excerpt = 1-2 oraciones REALES que resuman el plato —nunca vacío ni texto de relleno tipo "generado automáticamente"—, content_html = todo lo anterior); la tool devuelve id, slug y preview_url. Antes de cerrar armá ingredients con los nombres GENÉRICOS de cada ingrediente (p. ej. "peceto", "papa", "cebolla"); para la carne usá el CORTE (p. ej. "colita de cuadril"), nunca "carne", y NUNCA dejes la lista vacía. EN TU MENSAJE escribí SOLO 1 oración breve (p. ej. "Listo el borrador de la receta."); NO pegues el artículo. Los datos van únicamente en el bloque final OBLIGATORIO: <result>{"post_id":"<id>","slug":"<slug>","preview_url":"<preview_url>","ingredients":["…","…","…"]}</result>.',
    },
    {
      key: 'portada',
      agent_key: 'imagenes',
      parallel_group: 'enriquecer',
      // Enriquecimiento no crítico: si falla (p. ej. blip del proveedor), el run
      // sigue y el borrador queda válido; el cierre reporta el paso fallido.
      on_error: 'continue',
      label: 'Generar la portada',
      task: 'Generá la PORTADA (kind="cover") para el plato "{{input.topic}}" (apetitosa, bien servida, sin texto) y seteala en el post {{state.redactar.post_id}} con set_blog_cover (id + cover_image). Esa tool cambia SOLO la portada: NO uses update_blog_post ni toques el título, el extracto ni el contenido (los escribió el redactor). EN TU MENSAJE escribí SOLO 1 oración breve (p. ej. "Lista la portada."); esa oración va en el chat, NUNCA en un campo del artículo. Datos en: <result>{"cover_set":true}</result>.',
    },
    {
      key: 'productos',
      agent_key: 'catalogo',
      parallel_group: 'enriquecer',
      on_error: 'continue',
      label: 'Vincular productos del catálogo',
      task: 'Si {{input.con_productos}} no es false: para el post {{state.redactar.post_id}}, tomá la lista de ingredientes que te paso al final y buscá en el catálogo con manage_medusa_admin_products usando términos del ingrediente (NO el nombre del plato). Tu OBJETIVO es LINKEAR: sé eficiente y NO te quedes sin margen. Recorré los ingredientes y, apenas encontrás un producto que REALMENTE sea ese ingrediente, LINKEALO YA con link_blog_products (blog_post_id={{state.redactar.post_id}}) — no juntes todo para el final (link_blog_products AGREGA, no pisa, así que podés llamarlo varias veces). Descartá coincidencias por texto que no correspondan (un producto puede compartir una palabra y ser otra cosa). Para la carne buscá el CORTE; si el corte exacto no aparece, probá UNA sola alternativa equivalente y, si tampoco está, dejalo en "unmatched" y SEGUÍ: no gastes tus búsquedas en variantes de carne a costa de dejar sin linkear papa, cebolla, etc. Anotá en "unmatched" los ingredientes PRINCIPALES (sobre todo proteínas/carnes) sin producto. Si la lista de ingredientes llega vacía, NO inventes: devolvé product_ids:[] y unmatched:[]. EN TU MENSAJE escribí SOLO 1 oración breve (p. ej. "Vinculé 3 productos como ingredientes."). Los datos van en el bloque final OBLIGATORIO con TODOS los product_ids que linkeaste: <result>{"product_ids":["…"],"unmatched":["…"]}</result>. Ingredientes a buscar (usá esta lista tal cual): {{state.ingredients_effective}}',
    },
  ],
  final_action: { type: 'none' },
};

export function cloneWorkflowDefinition(definition: WorkflowDefinitionData): WorkflowDefinitionData {
  return {
    ...definition,
    steps: definition.steps.map((step) => ({ ...step })),
    final_action: definition.final_action ? { ...definition.final_action } : definition.final_action,
  };
}

const CANONICAL_WORKFLOW_DEFINITIONS: WorkflowDefinitionData[] = [
  RECIPE_WORKFLOW_DEFINITION,
  CAMPAIGN_WORKFLOW_DEFINITION,
];

export function getCanonicalWorkflowDefinition(key: string): WorkflowDefinitionData | undefined {
  const def = CANONICAL_WORKFLOW_DEFINITIONS.find((d) => d.key === key);
  return def ? cloneWorkflowDefinition(def) : undefined;
}

export function listCanonicalWorkflowDefinitions(): WorkflowDefinitionData[] {
  return CANONICAL_WORKFLOW_DEFINITIONS.map(cloneWorkflowDefinition);
}
