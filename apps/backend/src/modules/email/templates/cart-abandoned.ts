import type { EmailTemplateFunction, EmailTemplateResult } from './types';

/**
 * Fallback por código de los recordatorios de carrito abandonado (pasos 1-3).
 * El HTML rico y editable vive en la tabla `email_template` (branding inyectado
 * por el provider); esto es el respaldo mínimo cuando no hay template publicado.
 */
export type CartAbandonedData = {
  customer_name?: string;
  total?: string;
  currency_code?: string;
  item_count?: number;
  recovery_url?: string;
  [key: string]: unknown;
};

function greeting(name?: string): string {
  return name ? `Hola ${name},` : 'Hola,';
}

function cta(url?: string): string {
  return url
    ? `<p><a href="${url}">Retomá tu compra</a></p>`
    : '';
}

export const cartAbandonedStep1Template: EmailTemplateFunction<CartAbandonedData> = (
  data,
): EmailTemplateResult => ({
  subject: 'Te quedaron productos en el carrito 🛒',
  html: `<p>${greeting(data.customer_name)}</p><p>Guardamos tu carrito con ${
    data.item_count ?? ''
  } producto(s). ¿Querés terminar tu compra?</p>${cta(data.recovery_url)}`,
});

export const cartAbandonedStep2Template: EmailTemplateFunction<CartAbandonedData> = (
  data,
): EmailTemplateResult => ({
  subject: 'Tu carrito sigue esperándote',
  html: `<p>${greeting(data.customer_name)}</p><p>Todavía podés completar tu compra por un total de ${
    data.total ?? ''
  } ${data.currency_code ?? ''}.</p>${cta(data.recovery_url)}`,
});

export const cartAbandonedStep3Template: EmailTemplateFunction<CartAbandonedData> = (
  data,
): EmailTemplateResult => ({
  subject: 'Última oportunidad para tu carrito',
  html: `<p>${greeting(data.customer_name)}</p><p>Estamos por liberar el stock de tu carrito. Completá tu compra antes de que se agote.</p>${cta(
    data.recovery_url,
  )}`,
});
