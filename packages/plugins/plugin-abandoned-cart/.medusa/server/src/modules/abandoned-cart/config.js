"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAbandonedCartConfig = getAbandonedCartConfig;
exports.minIdleHours = minIdleHours;
exports.nextStepFor = nextStepFor;
const mercatto_plugin_runtime_1 = require("@minimalart/mercatto-plugin-runtime");
const settings_1 = require("./settings");
/**
 * Devuelve el template de WhatsApp configurado para un paso, o `null` si no hay
 * ninguno. Primero consulta al registry (host cablea `kapso-whatsapp`); si no
 * hay reader, cae a env.
 */
function whatsappTemplateFor(step) {
    const reader = (0, mercatto_plugin_runtime_1.getExternalReader)(mercatto_plugin_runtime_1.EXTERNAL_KEYS.KAPSO_WHATSAPP_SETTINGS);
    if (reader) {
        try {
            const settings = reader();
            const templates = settings?.templates;
            if (templates) {
                if (step === 1)
                    return templates.cartAbandoned1 ?? null;
                if (step === 2)
                    return templates.cartAbandoned2 ?? null;
                if (step === 3)
                    return templates.cartAbandoned3 ?? null;
                return null;
            }
        }
        catch {
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
function getAbandonedCartConfig() {
    const settings = (0, settings_1.getAbandonedCartSettings)();
    const [step1Hours, step2Hours, step3Hours] = settings.stepHours;
    const steps = [
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
function minIdleHours(config) {
    return config.steps.reduce((min, s) => Math.min(min, s.hoursAfterIdle), Number.POSITIVE_INFINITY);
}
/** Paso elegible más avanzado dado cuántos pasos ya se enviaron y la antigüedad. */
function nextStepFor(config, lastStepSent, idleHours) {
    const candidate = config.steps
        .filter((s) => s.step > lastStepSent && idleHours >= s.hoursAfterIdle)
        .sort((a, b) => a.step - b.step)[0];
    return candidate ?? null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvYWJhbmRvbmVkLWNhcnQvY29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FpQkc7O0FBK0VILHdEQWdDQztBQUdELG9DQUtDO0FBR0Qsa0NBU0M7QUFqSUQsaUZBQXVGO0FBQ3ZGLHlDQUFzRDtBQTJDdEQ7Ozs7R0FJRztBQUNILFNBQVMsbUJBQW1CLENBQUMsSUFBWTtJQUN2QyxNQUFNLE1BQU0sR0FBRyxJQUFBLDJDQUFpQixFQUM5Qix1Q0FBYSxDQUFDLHVCQUF1QixDQUN0QyxDQUFDO0lBQ0YsSUFBSSxNQUFNLEVBQUUsQ0FBQztRQUNYLElBQUksQ0FBQztZQUNILE1BQU0sUUFBUSxHQUFHLE1BQU0sRUFBRSxDQUFDO1lBQzFCLE1BQU0sU0FBUyxHQUFHLFFBQVEsRUFBRSxTQUFTLENBQUM7WUFDdEMsSUFBSSxTQUFTLEVBQUUsQ0FBQztnQkFDZCxJQUFJLElBQUksS0FBSyxDQUFDO29CQUFFLE9BQU8sU0FBUyxDQUFDLGNBQWMsSUFBSSxJQUFJLENBQUM7Z0JBQ3hELElBQUksSUFBSSxLQUFLLENBQUM7b0JBQUUsT0FBTyxTQUFTLENBQUMsY0FBYyxJQUFJLElBQUksQ0FBQztnQkFDeEQsSUFBSSxJQUFJLEtBQUssQ0FBQztvQkFBRSxPQUFPLFNBQVMsQ0FBQyxjQUFjLElBQUksSUFBSSxDQUFDO2dCQUN4RCxPQUFPLElBQUksQ0FBQztZQUNkLENBQUM7UUFDSCxDQUFDO1FBQUMsTUFBTSxDQUFDO1lBQ1AsZ0RBQWdEO1FBQ2xELENBQUM7SUFDSCxDQUFDO0lBQ0QsTUFBTSxHQUFHLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxvQ0FBb0MsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUNwRSxNQUFNLEtBQUssR0FBRyxPQUFPLEdBQUcsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0lBQ3hELE9BQU8sS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0FBQ3pDLENBQUM7QUFFRDs7OztHQUlHO0FBQ0gsU0FBZ0Isc0JBQXNCO0lBQ3BDLE1BQU0sUUFBUSxHQUFHLElBQUEsbUNBQXdCLEdBQUUsQ0FBQztJQUM1QyxNQUFNLENBQUMsVUFBVSxFQUFFLFVBQVUsRUFBRSxVQUFVLENBQUMsR0FBRyxRQUFRLENBQUMsU0FBUyxDQUFDO0lBQ2hFLE1BQU0sS0FBSyxHQUF3QjtRQUNqQztZQUNFLElBQUksRUFBRSxDQUFDO1lBQ1AsY0FBYyxFQUFFLFVBQVU7WUFDMUIsYUFBYSxFQUFFLGtCQUFrQjtZQUNqQyxnQkFBZ0IsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7U0FDekM7UUFDRDtZQUNFLElBQUksRUFBRSxDQUFDO1lBQ1AsY0FBYyxFQUFFLFVBQVU7WUFDMUIsYUFBYSxFQUFFLGtCQUFrQjtZQUNqQyxnQkFBZ0IsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7U0FDekM7UUFDRDtZQUNFLElBQUksRUFBRSxDQUFDO1lBQ1AsY0FBYyxFQUFFLFVBQVU7WUFDMUIsYUFBYSxFQUFFLGtCQUFrQjtZQUNqQyxnQkFBZ0IsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7U0FDekM7S0FDRixDQUFDO0lBRUYsT0FBTztRQUNMLE9BQU8sRUFBRSxRQUFRLENBQUMsT0FBTztRQUN6QixRQUFRLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyx3QkFBd0IsSUFBSSxjQUFjO1FBQ2hFLFNBQVMsRUFBRSxRQUFRLENBQUMsU0FBUztRQUM3QixRQUFRLEVBQUUsUUFBUSxDQUFDLFFBQVE7UUFDM0IsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXO1FBQ2pDLEtBQUs7S0FDTixDQUFDO0FBQ0osQ0FBQztBQUVELDJFQUEyRTtBQUMzRSxTQUFnQixZQUFZLENBQUMsTUFBMkI7SUFDdEQsT0FBTyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FDeEIsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsY0FBYyxDQUFDLEVBQzNDLE1BQU0sQ0FBQyxpQkFBaUIsQ0FDekIsQ0FBQztBQUNKLENBQUM7QUFFRCxvRkFBb0Y7QUFDcEYsU0FBZ0IsV0FBVyxDQUN6QixNQUEyQixFQUMzQixZQUFvQixFQUNwQixTQUFpQjtJQUVqQixNQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsS0FBSztTQUMzQixNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsWUFBWSxJQUFJLFNBQVMsSUFBSSxDQUFDLENBQUMsY0FBYyxDQUFDO1NBQ3JFLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3RDLE9BQU8sU0FBUyxJQUFJLElBQUksQ0FBQztBQUMzQixDQUFDIn0=