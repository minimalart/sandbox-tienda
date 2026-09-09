import { Modules } from '@medusajs/framework/utils';
import { createPromotionsWorkflow } from '@medusajs/core-flows';
import type { IFileModuleService, MedusaContainer } from '@medusajs/framework/types';
import { generateJSON } from '@tiptap/html';
import { generateImage, type AspectRatio } from '../../../landing-page/ai/image-client';
import { optimizeToWebp } from '../../../landing-page/ai/image-optimize';
import { BLOG_MODULE } from '../../../blog';
import type BlogModuleService from '../../../blog/service';
import { getBlogEditorExtensions } from '../../../blog/tiptap-extensions';
import { runWorkflow, type WorkflowDefinitionData } from '../workflow-engine';
import type { AiStore } from '../types';
import type { AgentEvent } from '../types';
import { upsertCampaign, findActiveCampaign, emptyCampaignState } from '../campaign';
import { getCanonicalWorkflowDefinition } from '../workflows/recipe';
import { validateGeneratedBlogContentHtml, stripEmptySourcesSection } from './blog-content-quality';
import { NATIVE_TOOL, isNativeTool } from './names';
import { WHATSAPP_TOOL_DEFS, runWhatsappNativeTool } from './whatsapp-tools';
import { ANALYTICS_TOOL_DEFS, runAnalyticsNativeTool } from './analytics-tools';
import { ARTIFACT_TOOL_DEFS, runArtifactNativeTool } from './artifact-tools';
import { LOYALTY_TOOL_DEFS, runLoyaltyNativeTool } from './loyalty-tools';

export { isNativeTool };

/**
 * Tools NATIVAS del Asistente IA: funciones JS in-process (no MCP) que le dan al
 * equipo capacidades que no existen como tools de Medusa: generar imágenes con
 * nano banana, y crear/actualizar/linkear borradores de blog. El loop las
 * descubre vía `tool-registry` y las ejecuta con `executeNativeTool`, pasando un
 * `NativeToolContext` con el container (para resolver File/Blog/StoreConfig).
 */
export type NativeToolContext = {
  container: MedusaContainer;
  /** Store del módulo (AiStore) — necesario para `start_workflow` (correr el motor). */
  store?: AiStore;
  /** Emisor de eventos SSE en vivo (para el checklist del workflow). */
  onEvent?: (ev: AgentEvent) => void;
  createdBy?: string | null;
  threadId?: string | null;
  /** WhatsApp: teléfono del cliente de la conversación actual (para scopear el
   * borrador de carrito y prefijar el checkout link). Lo setea el webhook. */
  waPhone?: string | null;
  /** WhatsApp: marca que en ESTE turno ya se corrió una búsqueda (se mostró la
   * lista de opciones). Sirve de guardrail: si es true, wa_add_to_cart NO agrega
   * (el cliente todavía no eligió una fila). Se resetea por turno. */
  didSearch?: boolean;
  /** WhatsApp: marca que en ESTE turno una tool YA le envió un mensaje al cliente
   * (lista/botones/imagen). El webhook entonces NO manda además el texto del modelo,
   * para no duplicar (un solo mensaje por turno). Se resetea por turno. */
  sentUserMessage?: boolean;
  /** WhatsApp: el turno viene de que el cliente TOCÓ un producto de la lista
   * (list_reply con variant_id). SOLO en ese caso wa_add_to_cart puede agregar: en
   * cualquier otro turno (texto, botón de control) NO se agrega (evita re-agregar y
   * duplicar el pedido). Lo setea el webhook. */
  isVariantSelection?: boolean;
  /** WhatsApp: el turno se resolvió con el LLM (`true`) o determinísticamente por
   * botón/lista (`false`). Va a la columna `used_ai` de `whatsapp_event`: el KPI
   * del embudo exige poder demostrar que un recorrido por botones llega al
   * checkout SIN gastar modelo. Lo setea el llamador (webhook / router). */
  waUsedAi?: boolean;
  /** WhatsApp: id de la sesión comercial en curso, para agrupar los eventos del
   * embudo (la fila de conversación es única por teléfono y vive para siempre). */
  waSessionId?: string | null;
  /**
   * Tienda que recibió el mensaje (`?site=` del webhook). Sin esto los eventos que
   * emiten las tools quedan sin `site_id` y el embudo por tienda mezcla todo.
   */
  waSiteId?: string | null;
  /**
   * Artefactos creados por tools nativas durante el turno. El mismo ctx viaja por
   * todo el workflow (start_workflow → motor → subagentes → execTool), así que el
   * motor puede RESCATAR de acá el borrador creado aunque el subagente se olvide
   * de repetir el post_id en su bloque <result> (pasaba: el redactor creaba el
   * post y el run entero quedaba `failed` "sin post_id", con el borrador huérfano
   * sin portada ni productos).
   */
  artifacts?: {
    last_blog_post?: { post_id: string; slug: string; preview_url: string };
  };
};

export type NativeToolDef = {
  name: string;
  description: string;
  // JSON Schema laxo (se sanea en buildToolsForModel).
  parameters: any;
};

const ASPECT_RATIOS: AspectRatio[] = ['16:9', '1:1', '4:3', '3:4', '9:16'];

export const NATIVE_TOOL_DEFS: NativeToolDef[] = [
  {
    name: NATIVE_TOOL.generateImage,
    description:
      'Genera una imagen con IA (nano banana / Gemini) a partir de un prompt en inglés descriptivo y la sube al storage; devuelve su URL pública (para usar como portada del artículo o como <img> dentro del contenido). Usá kind="cover" para la portada y kind="inline" para imágenes del cuerpo.',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description:
            'Descripción visual detallada de la imagen (preferentemente en inglés). Sin texto/letras dentro de la imagen salvo que se pida.',
        },
        kind: {
          type: 'string',
          enum: ['cover', 'inline'],
          description: 'cover = portada (16:9 ancho); inline = imagen del cuerpo.',
        },
        aspect_ratio: { type: 'string', enum: ASPECT_RATIOS },
        alt: { type: 'string', description: 'Texto alternativo accesible, en español.' },
      },
      required: ['prompt'],
      additionalProperties: false,
    },
  },
  {
    name: NATIVE_TOOL.createBlogPost,
    description:
      'Crea un BORRADOR de artículo de blog (status draft; nunca publica). El contenido va como HTML simple (h2/h3/p/ul/ol/li/strong/em/a/img). Devuelve el id del post. Pasá product_ids para linkear productos de la tienda (p. ej. ingredientes de una receta).',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        excerpt: { type: 'string', description: 'Resumen corto (1-2 oraciones).' },
        content_html: {
          type: 'string',
          description:
            'Cuerpo del artículo en HTML simple. Imágenes inline como <img src="URL" alt="...">. Sin <html>/<body>.',
        },
        cover_image: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            file_id: { type: 'string' },
            alt: { type: 'string' },
          },
          required: ['url'],
          additionalProperties: false,
        },
        category_id: { type: 'string' },
        seo_title: { type: 'string' },
        seo_description: { type: 'string' },
        product_ids: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'content_html'],
      additionalProperties: false,
    },
  },
  {
    name: NATIVE_TOOL.updateBlogPost,
    description:
      'Actualiza un borrador de blog existente por id (título, excerpt, contenido HTML, portada o SEO). No publica.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        excerpt: { type: 'string' },
        content_html: { type: 'string' },
        cover_image: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            file_id: { type: 'string' },
            alt: { type: 'string' },
          },
          required: ['url'],
          additionalProperties: false,
        },
        seo_title: { type: 'string' },
        seo_description: { type: 'string' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: NATIVE_TOOL.setBlogCover,
    description:
      'Setea SOLO la imagen de PORTADA de un borrador de blog existente (por id). NO toca el título, el extracto, el contenido ni el SEO: es la forma segura de poner la portada generada sin pisar el resto del artículo. Usala en lugar de update_blog_post cuando solo querés cambiar la portada.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        cover_image: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            file_id: { type: 'string' },
            alt: { type: 'string' },
          },
          required: ['url'],
          additionalProperties: false,
        },
      },
      required: ['id', 'cover_image'],
      additionalProperties: false,
    },
  },
  {
    name: NATIVE_TOOL.linkBlogProducts,
    description:
      'Vincula productos de la tienda a un artículo de blog. Por defecto AGREGA a los productos ya vinculados (sin borrarlos) y deduplica; pasá replace=true solo si querés reemplazar la lista completa. Los product_id se obtienen con la tool de productos del catálogo.',
    parameters: {
      type: 'object',
      properties: {
        blog_post_id: { type: 'string' },
        product_ids: { type: 'array', items: { type: 'string' } },
        replace: { type: 'boolean' },
      },
      required: ['blog_post_id', 'product_ids'],
      additionalProperties: false,
    },
  },
  {
    name: NATIVE_TOOL.startWorkflow,
    description:
      'Arranca un WORKFLOW orquestado por su key. El motor ejecuta los pasos definidos (despachando subagentes que vuelven con su resultado) de forma determinística y devuelve el resultado final. Usalo cuando el pedido del usuario coincide con un workflow disponible (p. ej. crear una receta). No sirve para tareas sueltas fuera de un workflow.',
    parameters: {
      type: 'object',
      properties: {
        workflow_key: {
          type: 'string',
          description: 'La key del workflow a correr (de la lista de workflows disponibles).',
        },
        input: {
          type: 'object',
          description:
            'Parámetros para el workflow (campos libres según el workflow; p. ej. { "topic": "pastas", "link_products": true }).',
          additionalProperties: true,
        },
      },
      required: ['workflow_key'],
      additionalProperties: false,
    },
  },
  {
    name: NATIVE_TOOL.campaignGet,
    description:
      'Devuelve el ESTADO COMPARTIDO de la campaña comercial del hilo actual (brief, entregables, selección de productos, promoción, outputs, validación) y su checklist. Usalo para saber qué falta antes de emitir el próximo bloque del wizard o antes de arrancar el workflow.',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: NATIVE_TOOL.campaignSet,
    description:
      'Aplica un patch (merge profundo) al estado compartido de la campaña comercial del hilo (crea la campaña si no existe). Devuelve el estado + checklist recomputados. Usalo para inicializar la campaña, registrar selecciones, volcar outputs de los subagentes o cambiar el status. NUNCA publica ni aplica nada: solo persiste estado.',
    parameters: {
      type: 'object',
      properties: {
        patch: {
          type: 'object',
          description:
            'Subárbol a mergear en el estado: campaign.{name,objective,start_date,end_date,customer_groups,tone}, deliverables.{blog_post,banner,promotion,landing}, product_selection.{mode,category_ids,tag_ids,product_ids,promotion_id}, promotion.{type,value,applies_to,customer_groups,conditions}, outputs.{blog_post,banner,landing,promotion}.',
          additionalProperties: true,
        },
        status: {
          type: 'string',
          enum: ['draft', 'intake', 'executing', 'preview', 'confirmed', 'cancelled'],
          description: 'Opcional: nuevo estado de la campaña.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: NATIVE_TOOL.preparePromotion,
    description:
      'Prepara una promoción de la campaña y la crea SIEMPRE en estado INACTIVO (status "inactive"): nunca se aplica/activa sin confirmación explícita del usuario (eso lo hace el botón "Aplicar promoción" del preview). Soporta type: percentage | fixed | bogo (2x1) | combo | free_shipping | highlight_only (este último NO crea promo, solo marca que se destacan los productos). Devuelve el promotion_id.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['percentage', 'fixed', 'bogo', 'combo', 'free_shipping', 'highlight_only'],
        },
        value: { type: 'number', description: 'Porcentaje (percentage) o monto (fixed). No aplica a bogo/free_shipping/highlight_only.' },
        product_ids: { type: 'array', items: { type: 'string' }, description: 'Productos alcanzados por la promo.' },
        customer_group_ids: { type: 'array', items: { type: 'string' }, description: 'Customer groups alcanzados (opcional).' },
        sales_channel_id: { type: 'string', description: 'Canal de ventas al que se acota la promo (opcional).' },
        currency_code: { type: 'string', description: 'Moneda para type fixed (default "ars").' },
        name: { type: 'string', description: 'Nombre de la campaña/promo (para el badge).' },
      },
      required: ['type'],
      additionalProperties: false,
    },
  },
  ...ANALYTICS_TOOL_DEFS,
  ...ARTIFACT_TOOL_DEFS,
  ...LOYALTY_TOOL_DEFS,
  ...WHATSAPP_TOOL_DEFS,
];

/** Config de imágenes desde store-config (modelo/calidad/peso); con fallback. */
async function resolveImageConfig(
  container: MedusaContainer,
): Promise<{ model?: string; quality: number; maxKb: number }> {
  try {
    const storeConfig: any = container.resolve('store-config');
    const ai = await storeConfig.getAiConfig();
    return {
      model: ai?.image_model,
      quality: typeof ai?.image_quality === 'number' ? ai.image_quality : 72,
      maxKb: typeof ai?.image_max_kb === 'number' ? ai.image_max_kb : 500,
    };
  } catch {
    return { quality: 72, maxKb: 500 };
  }
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

async function runGenerateImage(
  args: Record<string, unknown>,
  ctx: NativeToolContext,
): Promise<string> {
  const prompt = str(args.prompt);
  if (!prompt) return 'Error: falta `prompt` para generar la imagen.';
  const kind = args.kind === 'inline' ? 'inline' : 'cover';
  const aspect = ASPECT_RATIOS.includes(args.aspect_ratio as AspectRatio)
    ? (args.aspect_ratio as AspectRatio)
    : kind === 'cover'
      ? '16:9'
      : '4:3';
  const alt = str(args.alt) ?? '';

  const cfg = await resolveImageConfig(ctx.container);
  const generated = await generateImage({ prompt, model: cfg.model, aspectRatio: aspect });
  const webp = await optimizeToWebp(generated.bytes, kind === 'cover' ? 'hero' : 'imageBlock', {
    quality: cfg.quality,
    maxKb: cfg.maxKb,
  });

  const fileModule = ctx.container.resolve<IFileModuleService>(Modules.FILE);
  const [file] = await fileModule.createFiles([
    {
      filename: `blog-ai-${kind}-${Date.now()}.webp`,
      mimeType: 'image/webp',
      content: webp.base64,
      access: 'public',
    },
  ]);
  if (!file?.url) {
    return 'Error: la imagen se generó pero no se pudo subir al storage (sin URL).';
  }

  return `OK: imagen generada y subida. Usala como cover_image {url,file_id,alt} o como <img src="..."> en el contenido. url=${file.url} | file_id=${file.id} | alt=${alt}`;
}

/** HTML simple → Tiptap JSON (las extensiones del editor del blog, igual que render.ts). */
function htmlToTiptap(html: string): unknown {
  return generateJSON(html, getBlogEditorExtensions());
}

function blogService(ctx: NativeToolContext): BlogModuleService {
  return ctx.container.resolve(BLOG_MODULE) as unknown as BlogModuleService;
}

function coverFromArg(v: unknown): { url: string; file_id?: string | null; alt?: string | null } | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const url = str(o.url);
  if (!url) return undefined;
  return { url, file_id: str(o.file_id) ?? null, alt: str(o.alt) ?? null };
}

function rejectShortGeneratedContent(contentHtml: string): string | undefined {
  const validation = validateGeneratedBlogContentHtml(contentHtml);
  return validation.ok ? undefined : validation.message;
}

async function runCreateBlogPost(
  args: Record<string, unknown>,
  ctx: NativeToolContext,
): Promise<string> {
  const title = str(args.title);
  const contentHtml = str(args.content_html);
  if (!title) return 'Error: falta `title`.';
  if (!contentHtml) return 'Error: falta `content_html`.';

  // Guard anti-stub: un artículo real tiene cuerpo. El redactor a veces emitía solo un
  // título + un párrafo (content vacío en el editor). Medimos SOLO el texto plano (los
  // stubs observados tenían <60 chars; los artículos buenos, miles) para no rechazar
  // notas simples legítimas. El 'Error' vuelve como tool result → el redactor reescribe
  // el artículo completo en el mismo loop headless (sin dejar borrador huérfano: esto
  // corre ANTES de crear el post).
  const shortContentError = rejectShortGeneratedContent(contentHtml);
  if (shortContentError) return shortContentError;

  const svc = blogService(ctx);
  const slug = await (svc as any).ensureUniquePostSlug(title);
  let content: unknown = null;
  try {
    content = htmlToTiptap(stripEmptySourcesSection(contentHtml));
  } catch {
    return 'Error: no se pudo convertir el contenido HTML a formato del editor. Revisá que sea HTML simple y válido.';
  }

  const productIds = Array.isArray(args.product_ids)
    ? (args.product_ids as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];

  const post = await svc.createBlogPosts({
    title,
    slug,
    excerpt: str(args.excerpt) ?? null,
    cover_image: coverFromArg(args.cover_image) ?? null,
    content,
    status: 'draft',
    category_id: str(args.category_id) ?? null,
    seo_title: str(args.seo_title) ?? null,
    seo_description: str(args.seo_description) ?? null,
    published_at: null,
  } as any);
  // createBlogPosts puede devolver el row o un array según el caller.
  const created = Array.isArray(post) ? post[0] : post;
  const id = (created as { id: string }).id;

  if (productIds.length) {
    await (svc as any).setPostProducts(id, productIds);
  }

  const base = (process.env.STOREFRONT_URL || 'https://mercatto.minimalart.studio').replace(/\/$/, '');
  const previewUrl = `${base}/blog/${slug}?preview=1&exit_demo=1`;

  (ctx.artifacts ??= {}).last_blog_post = { post_id: id, slug, preview_url: previewUrl };

  return `OK: borrador de blog creado (status draft, NO publicado). id=${id} | slug=${slug} | preview_url=${previewUrl}${
    productIds.length ? ` | productos linkeados: ${productIds.length}` : ''
  }. Preview del post: ${previewUrl} · Editalo en el admin: Blog → Artículos (id ${id}).`;
}

async function runUpdateBlogPost(
  args: Record<string, unknown>,
  ctx: NativeToolContext,
): Promise<string> {
  const id = str(args.id);
  if (!id) return 'Error: falta `id` del artículo.';
  const svc = blogService(ctx);

  const next: Record<string, any> = { id };
  if (str(args.title)) next.title = str(args.title);
  if (str(args.excerpt) !== undefined) next.excerpt = str(args.excerpt);
  if (str(args.seo_title) !== undefined) next.seo_title = str(args.seo_title);
  if (str(args.seo_description) !== undefined) next.seo_description = str(args.seo_description);
  const cover = coverFromArg(args.cover_image);
  if (cover) next.cover_image = cover;
  const contentHtml = str(args.content_html);
  if (contentHtml) {
    const shortContentError = rejectShortGeneratedContent(contentHtml);
    if (shortContentError) return shortContentError;
    try {
      next.content = htmlToTiptap(stripEmptySourcesSection(contentHtml));
    } catch {
      return 'Error: no se pudo convertir el contenido HTML al formato del editor.';
    }
  }

  await svc.updateBlogPosts(next);
  return `OK: borrador ${id} actualizado.`;
}

/**
 * Setea SOLO la portada de un borrador. A diferencia de update_blog_post, NO acepta
 * title/excerpt/content/seo: el agente de imágenes usa esta tool para que su mensaje
 * de estado ("Lista la portada.") no termine, por error, pisando el título o el
 * extracto que ya escribió el redactor.
 */
async function runSetBlogCover(
  args: Record<string, unknown>,
  ctx: NativeToolContext,
): Promise<string> {
  const id = str(args.id);
  if (!id) return 'Error: falta `id` del artículo.';
  const cover = coverFromArg(args.cover_image);
  if (!cover) return 'Error: falta `cover_image` con al menos `url`.';
  const svc = blogService(ctx);
  await svc.updateBlogPosts({ id, cover_image: cover });
  return `OK: portada del borrador ${id} actualizada (no se tocó título, extracto ni contenido).`;
}

async function runLinkBlogProducts(
  args: Record<string, unknown>,
  ctx: NativeToolContext,
): Promise<string> {
  const id = str(args.blog_post_id);
  if (!id) return 'Error: falta `blog_post_id`.';
  const productIds = Array.isArray(args.product_ids)
    ? (args.product_ids as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  const replace = args.replace === true;
  const svc = blogService(ctx) as any;
  // Por defecto AGREGAMOS sin borrar lo ya vinculado (y deduplicamos): asociar un
  // ingrediente nuevo NO debe pisar los productos que el post ya tenía.
  let finalIds = productIds;
  let addedCount = productIds.length;
  if (!replace) {
    const existing: string[] = await svc.getPostProductIds(id).catch(() => [] as string[]);
    const seen = new Set(existing);
    const fresh = productIds.filter((p) => !seen.has(p));
    addedCount = fresh.length;
    finalIds = [...existing, ...fresh];
  }
  await svc.setPostProducts(id, finalIds);
  return `OK: ${finalIds.length} producto(s) vinculados al artículo ${id}${
    replace ? '' : ` (${addedCount} nuevo(s))`
  }.`;
}

async function runStartWorkflow(
  args: Record<string, unknown>,
  ctx: NativeToolContext,
): Promise<string> {
  const key = str(args.workflow_key);
  if (!key) return 'Error: falta `workflow_key`.';
  if (!ctx.store) return 'Error: el motor de workflows no está disponible en este contexto.';
  const rows = await (ctx.store as any)
    .listWorkflowDefinitions({ key }, { take: 1 })
    .catch(() => [] as unknown[]);
  const def = rows?.[0];
  const canonical = getCanonicalWorkflowDefinition(key);
  if (def?.enabled === false) {
    return `Error: el workflow "${key}" está deshabilitado. Pedile al usuario que lo habilite o usá otra vía.`;
  }
  if (!def && !canonical) {
    return `Error: no existe un workflow habilitado con key "${key}". Pedile al usuario que lo defina o usá otra vía.`;
  }
  // Los workflows de sistema viven en DB para poder verse/editarse desde el admin,
  // pero algunas instalaciones quedan con una definición vieja si no se re-seedearon.
  // Para receta usamos la versión canónica del código en runtime: evita volver a
  // crear borradores stub o saltarse el linkeo de productos por datos DB obsoletos.
  const definition: WorkflowDefinitionData =
    canonical ?? {
      key: def.key,
      name: def.name,
      description: def.description,
      steps: Array.isArray(def.steps) ? def.steps : [],
      final_action: def.final_action ?? null,
    };
  const input =
    args.input && typeof args.input === 'object' ? (args.input as Record<string, unknown>) : {};
  const result = await runWorkflow({
    store: ctx.store,
    nativeCtx: ctx,
    definition,
    input,
    threadId: ctx.threadId ?? null,
    createdBy: ctx.createdBy ?? null,
    onEvent: ctx.onEvent,
  });
  return `Workflow "${definition.name}" (${key}) → estado: ${result.status}.\nArtefactos/estado para redactar tu mensaje final al usuario: ${result.summary}`;
}

async function runCampaignGet(
  _args: Record<string, unknown>,
  ctx: NativeToolContext,
): Promise<string> {
  if (!ctx.store) return 'Error: el estado de campaña no está disponible en este contexto.';
  const row = await findActiveCampaign(ctx.store, ctx.threadId ?? null);
  if (!row) {
    return `No hay campaña en curso en este hilo. Estado vacío (para arrancar, llamá campaign_set con el brief): ${JSON.stringify(
      emptyCampaignState(),
    )}`;
  }
  return `campaign_id=${row.id} | status=${row.status}\nstate=${JSON.stringify(row.state)}\nchecklist=${JSON.stringify(
    row.checklist,
  )}`;
}

async function runCampaignSet(
  args: Record<string, unknown>,
  ctx: NativeToolContext,
): Promise<string> {
  if (!ctx.store) return 'Error: el estado de campaña no está disponible en este contexto.';
  const patch =
    args.patch && typeof args.patch === 'object' ? (args.patch as Record<string, unknown>) : {};
  const statusOverride = typeof args.status === 'string' ? (args.status as string) : undefined;
  const row = await upsertCampaign({
    store: ctx.store,
    threadId: ctx.threadId ?? null,
    createdBy: ctx.createdBy ?? null,
    patch,
    statusOverride,
  });
  return `OK: estado de campaña actualizado. campaign_id=${row.id} | status=${row.status}\nstate=${JSON.stringify(
    row.state,
  )}\nchecklist=${JSON.stringify(row.checklist)}`;
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === 'string') : [];
}

/**
 * Crea una promoción de campaña SIEMPRE inactiva (status 'inactive'). La activación
 * es una acción aparte y explícita (botón del preview → endpoint campaign-action).
 * Wrapea `createPromotionsWorkflow` con la misma forma de payload que el demo.
 */
async function runPreparePromotion(
  args: Record<string, unknown>,
  ctx: NativeToolContext,
): Promise<string> {
  const type = str(args.type);
  if (!type) return 'Error: falta `type` de la promoción.';
  if (type === 'highlight_only') {
    return 'OK: type=highlight_only → no se crea promoción; solo se destacan los productos seleccionados. <result>{"promotion_id":null,"type":"highlight_only","status":"none"}</result>';
  }
  const productIds = arr(args.product_ids);
  if (productIds.length === 0 && type !== 'free_shipping') {
    return 'Error: faltan `product_ids` alcanzados por la promoción.';
  }
  const value = typeof args.value === 'number' ? args.value : Number(args.value);
  const currency = str(args.currency_code) ?? 'ars';
  const name = str(args.name) ?? 'Promoción de campaña';
  const groupIds = arr(args.customer_group_ids);
  const scId = str(args.sales_channel_id);

  const rules: Array<Record<string, unknown>> = [];
  if (scId) rules.push({ attribute: 'sales_channel_id', operator: 'eq', values: [scId] });
  if (groupIds.length) rules.push({ attribute: 'customer.groups.id', operator: 'in', values: groupIds });

  const targetRules = [{ attribute: 'items.product.id', operator: 'in', values: productIds }];
  let promotionsData: any;

  if (type === 'percentage' || type === 'fixed') {
    if (!Number.isFinite(value) || value <= 0) return 'Error: `value` inválido para la promoción.';
    promotionsData = [{
      type: 'standard',
      status: 'inactive',
      is_automatic: true,
      application_method: {
        type: type === 'fixed' ? 'fixed' : 'percentage',
        target_type: 'items',
        allocation: 'across',
        value,
        ...(type === 'fixed' ? { currency_code: currency } : {}),
        target_rules: targetRules,
      },
      rules,
      campaign: { name },
    }];
  } else if (type === 'bogo' || type === 'combo') {
    // 2x1 / combo: comprar 2, el 3.º (o el de menor valor) al 100% off.
    promotionsData = [{
      type: 'buyget',
      status: 'inactive',
      is_automatic: true,
      application_method: {
        type: 'percentage',
        target_type: 'items',
        allocation: 'each',
        value: 100,
        max_quantity: 1,
        apply_to_quantity: 1,
        buy_rules_min_quantity: 2,
        buy_rules: [{ attribute: 'items.product.id', operator: 'in', values: productIds }],
        target_rules: targetRules,
      },
      rules,
      campaign: { name },
    }];
  } else if (type === 'free_shipping') {
    promotionsData = [{
      type: 'standard',
      status: 'inactive',
      is_automatic: true,
      application_method: {
        type: 'percentage',
        target_type: 'shipping_methods',
        allocation: 'across',
        value: 100,
      },
      rules,
      campaign: { name },
    }];
  } else {
    return `Error: type de promoción no soportado: ${type}.`;
  }

  const { result } = await createPromotionsWorkflow(ctx.container as any).run({
    input: { promotionsData },
  });
  const created = Array.isArray(result) ? result[0] : result;
  const id = (created as { id?: string })?.id ?? null;
  return `OK: promoción creada INACTIVA (no aplicada). promotion_id=${id} | type=${type}. Para aplicarla, el usuario debe confirmarlo en el preview. <result>{"promotion_id":"${id}","type":"${type}","status":"inactive"}</result>`;
}

/** Ejecuta una tool nativa por nombre. Devuelve texto (igual que el resto de tools). */
export async function executeNativeTool(
  name: string,
  args: Record<string, unknown>,
  ctx?: NativeToolContext,
): Promise<string> {
  if (!ctx) {
    return `Error: la herramienta "${name}" no está disponible en este contexto.`;
  }
  try {
    switch (name) {
      case NATIVE_TOOL.generateImage:
        return await runGenerateImage(args, ctx);
      case NATIVE_TOOL.createBlogPost:
        return await runCreateBlogPost(args, ctx);
      case NATIVE_TOOL.updateBlogPost:
        return await runUpdateBlogPost(args, ctx);
      case NATIVE_TOOL.setBlogCover:
        return await runSetBlogCover(args, ctx);
      case NATIVE_TOOL.linkBlogProducts:
        return await runLinkBlogProducts(args, ctx);
      case NATIVE_TOOL.startWorkflow:
        return await runStartWorkflow(args, ctx);
      case NATIVE_TOOL.campaignGet:
        return await runCampaignGet(args, ctx);
      case NATIVE_TOOL.campaignSet:
        return await runCampaignSet(args, ctx);
      case NATIVE_TOOL.preparePromotion:
        return await runPreparePromotion(args, ctx);
      default: {
        const analytics = await runAnalyticsNativeTool(name, args, ctx);
        if (analytics !== undefined) return analytics;
        const artifact = await runArtifactNativeTool(name, args, ctx);
        if (artifact !== undefined) return artifact;
        const loyalty = await runLoyaltyNativeTool(name, args, ctx);
        if (loyalty !== undefined) return loyalty;
        const wa = await runWhatsappNativeTool(name, args, ctx);
        if (wa !== undefined) return wa;
        return `Error: herramienta nativa desconocida "${name}".`;
      }
    }
  } catch (e) {
    return `Error ejecutando ${name}: ${(e as Error).message}`;
  }
}
