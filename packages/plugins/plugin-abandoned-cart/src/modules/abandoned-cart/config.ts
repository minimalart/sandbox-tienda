/**
 * Configuración de la recuperación de carritos abandonados, con defaults
 * sensatos. No acopla el código a valores fijos: la cadencia y los umbrales se
 * ajustan sin tocar código.
 *
 * En el plugin, los siete valores editables salen de `./settings.ts` (que
 * consulta el snapshot del host vía `@minimalart/mercatto-plugin-runtime`, con
 * fallback a env). Los nombres de plantilla de WhatsApp se leen del mismo
 * runtime: el host registra un getter con la shape de
 * `kapso-whatsapp/settings` bajo la key `EXTERNAL_KEYS.KAPSO_WHATSAPP_SETTINGS`,
 * y este archivo lo consume. Sin ese getter registrado, se cae a
 * `ABANDONED_CART_WHATSAPP_TEMPLATE_{1,2,3}` — misma semántica que tenía la
 * extensión "antes de que el snapshot estuviera cargado".
 *
 * `scanCron` se sigue leyendo del entorno acá: el `schedule:` de un job lo
 * hornea el loader al arrancar, cuando ninguna capa de settings dinámica está
 * disponible todavía.
 */

import { EXTERNAL_KEYS, getExternalReader } from '@minimalart/mercatto-plugin-runtime';
import { getAbandonedCartSettings } from './settings';

export type AbandonedCartStep = {
  /** Paso 1-based de la secuencia. */
  step: number;
  /** Horas de inactividad del carrito para que este paso sea elegible. */
  hoursAfterIdle: number;
  /** Key lógica del template de email (o null para no enviar email en el paso). */
  emailTemplate: string | null;
  /** Key lógica del template de WhatsApp (o null para no enviar WhatsApp). */
  whatsappTemplate: string | null;
};

export type AbandonedCartConfig = {
  enabled: boolean;
  scanCron: string;
  /** Máx. de carritos por página de la detección (evita picos de memoria). */
  batchSize: number;
  /**
   * Máx. de páginas a recorrer por corrida. La detección pagina la ventana
   * completa (no un solo lote), así que este tope es lo que acota el trabajo por
   * corrida: `batchSize * maxPages` carritos. Al alcanzarlo se loguea el
   * truncamiento — nunca se corta en silencio.
   */
  maxPages: number;
  /** No molestar carritos más viejos que esto (cierra la ventana de recuperación). */
  maxAgeHours: number;
  steps: AbandonedCartStep[];
};

/**
 * Shape que este plugin espera del reader de kapso-whatsapp registrado en el
 * runtime contract. Es el subconjunto que necesitamos — el host puede exponer
 * más campos y este archivo los ignora.
 */
type KapsoWhatsappTemplates = {
  templates: {
    cartAbandoned1: string | null;
    cartAbandoned2: string | null;
    cartAbandoned3: string | null;
  };
};

/**
 * Devuelve el template de WhatsApp configurado para un paso, o `null` si no hay
 * ninguno. Primero consulta al registry (host cablea `kapso-whatsapp`); si no
 * hay reader, cae a env.
 */
function whatsappTemplateFor(step: number): string | null {
  const reader = getExternalReader<KapsoWhatsappTemplates>(
    EXTERNAL_KEYS.KAPSO_WHATSAPP_SETTINGS,
  );
  if (reader) {
    try {
      const settings = reader();
      const templates = settings?.templates;
      if (templates) {
        if (step === 1) return templates.cartAbandoned1 ?? null;
        if (step === 2) return templates.cartAbandoned2 ?? null;
        if (step === 3) return templates.cartAbandoned3 ?? null;
        return null;
      }
    } catch {
      // Reader que tira no rompe el email: cae a env.
    }
  }
  const raw = process.env[`ABANDONED_CART_WHATSAPP_TEMPLATE_${step}`];
  const value = typeof raw === 'string' ? raw.trim() : '';
  return value.length > 0 ? value : null;
}

/**
 * Secuencia por defecto de 3 pasos: 1h (email), 24h (email + WhatsApp opcional),
 * 72h (email con incentivo). Los offsets son horas de inactividad ACUMULADAS
 * desde la última actividad del carrito, no entre pasos.
 */
export function getAbandonedCartConfig(): AbandonedCartConfig {
  const settings = getAbandonedCartSettings();
  const [step1Hours, step2Hours, step3Hours] = settings.stepHours;
  const steps: AbandonedCartStep[] = [
    {
      step: 1,
      hoursAfterIdle: step1Hours,
      emailTemplate: 'cart-abandoned-1',
      whatsappTemplate: whatsappTemplateFor(1),
    },
    {
      step: 2,
      hoursAfterIdle: step2Hours,
      emailTemplate: 'cart-abandoned-2',
      whatsappTemplate: whatsappTemplateFor(2),
    },
    {
      step: 3,
      hoursAfterIdle: step3Hours,
      emailTemplate: 'cart-abandoned-3',
      whatsappTemplate: whatsappTemplateFor(3),
    },
  ];

  return {
    enabled: settings.enabled,
    scanCron: process.env.ABANDONED_CART_SCAN_CRON || '*/15 * * * *',
    batchSize: settings.batchSize,
    maxPages: settings.maxPages,
    maxAgeHours: settings.maxAgeHours,
    steps,
  };
}

/** El primer paso define el umbral mínimo de inactividad para trackear. */
export function minIdleHours(config: AbandonedCartConfig): number {
  return config.steps.reduce(
    (min, s) => Math.min(min, s.hoursAfterIdle),
    Number.POSITIVE_INFINITY,
  );
}

/** Paso elegible más avanzado dado cuántos pasos ya se enviaron y la antigüedad. */
export function nextStepFor(
  config: AbandonedCartConfig,
  lastStepSent: number,
  idleHours: number,
): AbandonedCartStep | null {
  const candidate = config.steps
    .filter((s) => s.step > lastStepSent && idleHours >= s.hoursAfterIdle)
    .sort((a, b) => a.step - b.step)[0];
  return candidate ?? null;
}
