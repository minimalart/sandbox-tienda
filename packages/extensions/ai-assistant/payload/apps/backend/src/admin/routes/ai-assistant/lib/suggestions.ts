// Skills + preguntas predefinidas del Asistente IA (adaptadas al dominio Medusa
// B2C). Los ids de skill coinciden con los del backend (ai/prompt.ts).

export type SkillOption = { id: string; label: string };

export const SKILL_OPTIONS: SkillOption[] = [
  { id: 'auto', label: 'General' },
  { id: 'ventas', label: 'Ventas y crecimiento' },
  { id: 'productos', label: 'Catálogo y productos' },
  { id: 'clientes', label: 'Clientes y segmentos' },
  { id: 'ordenes', label: 'Órdenes y operaciones' },
  { id: 'promociones', label: 'Promociones y precios' },
];

export const SUGGESTIONS_BY_SKILL: Record<string, string[]> = {
  auto: [
    '¿Cómo vienen las ventas del último mes?',
    'Top 10 productos por monto del último período',
    '¿Qué órdenes están pendientes de pago o de envío?',
    '¿Cuántos clientes nuevos hubo este mes?',
  ],
  ventas: [
    '¿Cómo evolucionaron las ventas netas mes a mes?',
    '¿Cuál es el ticket promedio y cómo cambió?',
    '¿Qué palancas tengo para subir conversión y recompra?',
    '¿Qué días y categorías concentran las ventas?',
  ],
  productos: [
    'Top 10 productos más vendidos del período',
    '¿Qué productos están sin stock o con poco inventario?',
    '¿Qué categorías crecen y cuáles caen?',
    '¿Qué bundles ayudarían a subir el ticket?',
  ],
  clientes: [
    '¿Cuántos clientes nuevos vs recurrentes hubo?',
    '¿Qué clientes son de mayor valor?',
    '¿Qué segmentos están en riesgo de no recomprar?',
    '¿Qué grupos de clientes conviene activar?',
  ],
  ordenes: [
    '¿Qué órdenes están impagas o pendientes de envío?',
    '¿Cuántas cancelaciones y devoluciones hubo?',
    '¿Hay demoras de fulfillment para revisar?',
    '¿Cómo viene la tasa de completadas vs canceladas?',
  ],
  promociones: [
    '¿Qué promociones están activas hoy?',
    '¿Qué impacto tuvieron las promos del último mes?',
    '¿Qué price lists conviene revisar?',
    '¿Qué descuento propondrías para subir frecuencia?',
  ],
};

export const MODEL_OPTIONS: { id: string; name: string }[] = [
  // GPT-4.1 Mini es el modelo por defecto del chat (primero de la lista).
  { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini' },
  { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
];
