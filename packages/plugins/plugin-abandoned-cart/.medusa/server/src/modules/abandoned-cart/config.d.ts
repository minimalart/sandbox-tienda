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
 * Secuencia por defecto de 3 pasos: 1h (email), 24h (email + WhatsApp opcional),
 * 72h (email con incentivo). Los offsets son horas de inactividad ACUMULADAS
 * desde la última actividad del carrito, no entre pasos.
 */
export declare function getAbandonedCartConfig(): AbandonedCartConfig;
/** El primer paso define el umbral mínimo de inactividad para trackear. */
export declare function minIdleHours(config: AbandonedCartConfig): number;
/** Paso elegible más avanzado dado cuántos pasos ya se enviaron y la antigüedad. */
export declare function nextStepFor(config: AbandonedCartConfig, lastStepSent: number, idleHours: number): AbandonedCartStep | null;
