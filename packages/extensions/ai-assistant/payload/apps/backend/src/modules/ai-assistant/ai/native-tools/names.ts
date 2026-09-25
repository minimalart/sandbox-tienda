/**
 * Nombres de las tools NATIVAS (in-process) del Asistente IA: a diferencia de las
 * del MCP, no salen de un servidor sino de funciones JS locales (ver `index.ts`).
 * Se aísla en su propio archivo (sin deps pesadas) para que `policy.ts` pueda
 * importarlo sin arrastrar sharp/tiptap/blog.
 */
export const NATIVE_TOOL = {
  generateImage: 'generate_image',
  createBlogPost: 'create_blog_post',
  updateBlogPost: 'update_blog_post',
  setBlogCover: 'set_blog_cover',
  linkBlogProducts: 'link_blog_products',
  startWorkflow: 'start_workflow',
  campaignGet: 'campaign_get',
  campaignSet: 'campaign_set',
  preparePromotion: 'prepare_promotion',
  // Analytics (lecturas agregadas para el análisis proactivo de propuestas).
  analyzeSales: 'analyze_sales',
  analyzeProducts: 'analyze_products',
  analyzeCustomers: 'analyze_customers',
  analyzePromotions: 'analyze_promotions',
  analyzeCarts: 'analyze_carts',
  analyzeSearchGaps: 'analyze_search_gaps',
  analyzeLoyalty: 'analyze_loyalty',
  // Artefactos completos para propuestas (borradores con imagen/contenido).
  createBannerDraft: 'create_banner_draft',
  createLandingDraft: 'create_landing_draft',
  // Fidelización y segmentos (solo ejecutan al aprobar una propuesta).
  createLoyaltyCampaign: 'create_loyalty_campaign',
  createLoyaltyReward: 'create_loyalty_reward',
  issueGiftCard: 'issue_gift_card',
  createDynamicGroup: 'create_dynamic_group',
  // Bot de compra por WhatsApp (de cara al cliente).
  waSearchProducts: 'wa_search_products',
  waAddToCart: 'wa_add_to_cart',
  waViewCart: 'wa_view_cart',
  waRemoveFromCart: 'wa_remove_from_cart',
  waCheckoutLink: 'wa_checkout_link',
  waHandoffToHuman: 'wa_handoff_to_human',
  waStartReturn: 'wa_start_return',
  waRequestReturn: 'wa_request_return',
  waProductDetail: 'wa_product_detail',
  waAskButtons: 'wa_ask_buttons',
  waReviewOrder: 'wa_review_order',
  waSetQuantity: 'wa_set_quantity',
  waClearCart: 'wa_clear_cart',
  waGuidedStart: 'wa_guided_start',
  waListPresentations: 'wa_list_presentations',
  waListPinned: 'wa_list_pinned',
  waListFiltered: 'wa_list_filtered',
  waLookupOrder: 'wa_lookup_order',
} as const;

export const NATIVE_TOOL_NAMES: ReadonlySet<string> = new Set(Object.values(NATIVE_TOOL));

export function isNativeTool(name: string): boolean {
  return NATIVE_TOOL_NAMES.has(name);
}

/**
 * Tools nativas SEGURAS durante un análisis headless de propuestas: solo
 * lecturas agregadas (no crean artefactos). Las demás nativas son `auto` porque
 * nunca publican, pero en modo análisis NO deben ejecutarse (el analista debe
 * PROPONERLAS y las corre `executeProposal` recién al aprobar).
 */
export const NATIVE_ANALYSIS_TOOLS: ReadonlySet<string> = new Set([
  NATIVE_TOOL.analyzeSales,
  NATIVE_TOOL.analyzeProducts,
  NATIVE_TOOL.analyzeCustomers,
  NATIVE_TOOL.analyzePromotions,
  NATIVE_TOOL.analyzeCarts,
  NATIVE_TOOL.analyzeSearchGaps,
  NATIVE_TOOL.analyzeLoyalty,
  NATIVE_TOOL.campaignGet,
]);

/** Gate de nativas del loop headless: 'all' (workflows) ejecuta todas; 'analysis-only' solo las de análisis. */
export type NativeToolsPolicy = 'all' | 'analysis-only';

export function isNativeToolBlockedInAnalysis(
  name: string,
  policy: NativeToolsPolicy | undefined,
): boolean {
  return policy === 'analysis-only' && isNativeTool(name) && !NATIVE_ANALYSIS_TOOLS.has(name);
}
