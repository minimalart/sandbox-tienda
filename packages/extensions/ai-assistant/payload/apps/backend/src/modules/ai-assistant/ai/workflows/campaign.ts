import type { WorkflowDefinitionData } from '../workflow-engine';

/**
 * Definición CANÓNICA del workflow "Campaña comercial". Igual que la receta,
 * vive en código y es la que usa el motor en runtime (la fila en DB queda para
 * verla desde el admin; `seed-campaign-team.ts` la sincroniza desde acá).
 *
 * Lecciones del run del 2026-07-23 (campaña "Día de los Enamorados"): el banner
 * salía sin imagen, la landing vacía y la nota sin portada — los pasos "cerraban
 * bien" (emitían su <result>) pero nadie exigía el artefacto completo. Además de
 * reforzar las tasks, el motor ENRIQUECE determinísticamente banner y landing
 * tras el paso (ver workflow-engine.ts).
 */
export const CAMPAIGN_WORKFLOW_DEFINITION: WorkflowDefinitionData = {
  key: 'campania_comercial',
  name: 'Campaña comercial',
  description:
    'Ejecuta una campaña comercial: resuelve/valida productos, prepara la promoción (inactiva), crea los borradores de nota/banner/landing en paralelo y valida la coherencia. No publica ni aplica nada (eso lo confirma el usuario en el preview).',
  steps: [
    {
      key: 'resolver_productos',
      agent_key: 'catalogo',
      label: 'Selección de productos',
      task:
        'Resolvé los productos de la campaña "{{input.campaign.name}}" según el modo {{input.product_selection.mode}}. ' +
        'Si es "ai_suggested": sugerí entre 6 y 12 productos relevantes para el objetivo {{input.campaign.objective}} y las fechas {{input.campaign.start_date}}–{{input.campaign.end_date}}, buscando en el catálogo con manage_medusa_admin_products. ' +
        'Si es "manual": usá estos product_ids: {{input.product_selection.product_ids}}. ' +
        'Si es "category": traé productos de las categorías {{input.product_selection.category_ids}}. ' +
        'Si es "tag": de las etiquetas {{input.product_selection.tag_ids}}. ' +
        'Si es "from_promotion": de la promoción {{input.product_selection.promotion_id}}. ' +
        'Validá que existan y tengan precio/stock; descartá los que no. ' +
        'Cerrá SOLO con: <result>{"product_ids":["…"],"notes":"…"}</result>.',
    },
    {
      key: 'preparar_promocion',
      agent_key: 'promociones',
      when: 'input.deliverables.promotion',
      label: 'Configuración de promoción',
      task:
        'Preparé la promoción de la campaña con la tool prepare_promotion (SIEMPRE queda INACTIVA, no se aplica): ' +
        'type={{input.promotion.type}}, value={{input.promotion.value}}, ' +
        'product_ids={{state.resolver_productos.product_ids}}, ' +
        'customer_group_ids={{input.promotion.customer_groups}}, name="{{input.campaign.name}}". ' +
        'Cerrá con el bloque <result> que devuelve la tool.',
    },
    {
      key: 'crear_nota',
      agent_key: 'redactor',
      when: 'input.deliverables.blog_post',
      parallel_group: 'content',
      label: 'Nota de blog',
      on_error: 'continue' as const,
      task:
        'Escribí y creá el BORRADOR (status draft) de la nota de blog de la campaña "{{input.campaign.name}}" con create_blog_post. ' +
        'Tono: {{input.campaign.tone}}. Reflejá el objetivo {{input.campaign.objective}} y la vigencia {{input.campaign.start_date}}–{{input.campaign.end_date}}. ' +
        'Antes de crear el post, generá la PORTADA con generate_image (kind="cover", 16:9; una escena acorde a la campaña y al tono, sin texto dentro de la imagen): la tool te devuelve url=<URL>. ' +
        'En create_blog_post pasá cover_image={"url":"<esa URL exacta>","alt":"<descripción breve>"} — una nota sin portada se ve rota en el blog. ' +
        'Vinculá los productos {{state.resolver_productos.product_ids}} pasándolos como product_ids. ' +
        'NO publiques. Cerrá SOLO con: <result>{"post_id":"…","slug":"…","preview_url":"…"}</result>.',
    },
    {
      key: 'crear_banner',
      agent_key: 'imagenes',
      when: 'input.deliverables.banner',
      parallel_group: 'content',
      label: 'Banner',
      on_error: 'continue' as const,
      task:
        'PRIMERO generá la imagen del banner con generate_image (kind="cover", 16:9) para la campaña "{{input.campaign.name}}" (tono {{input.campaign.tone}}; sin texto dentro de la imagen): la tool te devuelve url=<URL>. ' +
        'DESPUÉS creá el BANNER en estado draft con manage_minimalart_extensions (resource "banners", action "create"): ' +
        'internal_name="{{input.campaign.name}}", type="hero", placement="banner_1", status="draft", ' +
        'content con title y subtitle acordes, y — OBLIGATORIO — media={"url":"<esa URL exacta>","alt":"<descripción>","type":"image"}. ' +
        'Un banner sin media queda invisible en la tienda y NO sirve: nunca lo crees sin media. ' +
        'Si generate_image devolvió Error, reintentala UNA vez antes de crear el banner. ' +
        'NO publiques. Cerrá SOLO con: <result>{"banner_id":"…"}</result>.',
    },
    {
      key: 'crear_landing',
      agent_key: 'redactor',
      when: 'input.deliverables.landing',
      parallel_group: 'content',
      label: 'Landing',
      on_error: 'continue' as const,
      task:
        'Creá una LANDING en estado draft para la campaña "{{input.campaign.name}}" con manage_minimalart_extensions (resource "landing_pages", action "create"): ' +
        'title="{{input.campaign.name}}", un slug único en minúsculas, status="draft", y seo (title + description acordes al tono {{input.campaign.tone}}) — el seo NO es opcional. ' +
        'NO armes bloques de contenido: el sistema compone el contenido de la landing automáticamente después de crearla. ' +
        'NO publiques. Cerrá SOLO con: <result>{"landing_id":"…","slug":"…"}</result>.',
    },
    {
      key: 'validar',
      agent_key: 'validador',
      label: 'Validación final',
      task:
        'Validá la coherencia de la campaña. Estado: campaign={{input.campaign}}, deliverables={{input.deliverables}}, promotion={{input.promotion}}; ' +
        'productos resueltos={{state.resolver_productos.product_ids}}. ' +
        'Revisá fechas (inicio < fin), que los productos existan y tengan precio/stock, que la promo (si hay) alcance productos válidos y que el público exista. ' +
        'OJO: campaign.customer_groups puede traer los sentinels "all" (= todos los clientes) o "none" (= sin segmentar); son VÁLIDOS por diseño del wizard, NO los reportes como grupos inexistentes. ' +
        'Cerrá SOLO con: <result>{"is_ready":true,"warnings":["…"],"missing_fields":["…"]}</result>.',
    },
  ],
  final_action: { type: 'confirm' as const },
};
