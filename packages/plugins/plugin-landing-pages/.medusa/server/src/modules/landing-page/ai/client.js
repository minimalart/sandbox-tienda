"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAiConfig = getAiConfig;
exports.isAiConfigured = isAiConfigured;
exports.callOpenRouter = callOpenRouter;
const settings_1 = require("../settings");
const types_1 = require("./types");
/**
 * Cliente AI server-side vía OpenRouter (https://openrouter.ai), que es
 * compatible con la API Chat Completions de OpenAI. Un único cliente alcanza:
 * el modelo se configura (OPENROUTER_MODEL) y puede apuntar a cualquier
 * proveedor (`openai/gpt-4.1-mini`, `anthropic/claude-3.5-sonnet`, etc.).
 *
 * La API key NUNCA se expone al admin/storefront: estas llamadas sólo corren
 * en el backend.
 *
 * Los cuatro valores salen de `landing-page/settings.ts` y no de `process.env`.
 * Los dos propios (modelo, reintentos) se editan en la card de esta extensión;
 * la key y la atribución las edita el Asistente IA, que es su dueño, y acá se lee
 * el MISMO valor —no una copia del entorno— para que rotarla no deje al generador
 * de landings tirando 503 con la vieja. Ver el encabezado de `settings.ts`.
 */
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
/**
 * `apiKey` se devuelve como `string | undefined` y no como `''` porque
 * `isAiConfigured()` y el `if (!apiKey)` de abajo se apoyan en que sea falsy, y
 * porque es la forma pública que ya consumen `generator.ts` y `banner/ai/*`.
 */
function getAiConfig() {
    const { apiKey, model, maxRetries } = (0, settings_1.getLandingAiSettings)();
    return { apiKey: apiKey || undefined, model, maxRetries };
}
function isAiConfigured() {
    return Boolean(getAiConfig().apiKey);
}
async function callOpenRouter(messages, opts) {
    const { apiKey, model: defaultModel } = getAiConfig();
    const model = opts?.model?.trim() || defaultModel;
    if (!apiKey) {
        throw new types_1.LandingAiError('OPENROUTER_API_KEY no está configurada en el backend.', 503);
    }
    let res;
    try {
        res = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                // Headers recomendados por OpenRouter para atribución (opcionales).
                'HTTP-Referer': (0, settings_1.getLandingAiSettings)().siteUrl,
                'X-Title': 'Mercatto Landing Builder',
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0.5,
                max_tokens: 4000,
                // Pedimos JSON estricto; modelos que no lo soporten lo ignoran y el
                // generador igual extrae/valida el JSON de la respuesta.
                response_format: { type: 'json_object' },
            }),
        });
    }
    catch (err) {
        throw new types_1.LandingAiError(`No se pudo conectar con OpenRouter: ${err.message}`, 502);
    }
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new types_1.LandingAiError(`OpenRouter respondió ${res.status}: ${body.slice(0, 300)}`, 502);
    }
    const data = (await res.json().catch(() => null));
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
        throw new types_1.LandingAiError('OpenRouter devolvió una respuesta vacía.', 502);
    }
    return content;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvbGFuZGluZy1wYWdlL2FpL2NsaWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQStCQSxrQ0FHQztBQUVELHdDQUVDO0FBRUQsd0NBMERDO0FBbEdELDBDQUFtRDtBQUNuRCxtQ0FBeUM7QUFFekM7Ozs7Ozs7Ozs7Ozs7O0dBY0c7QUFFSCxNQUFNLGNBQWMsR0FBRywrQ0FBK0MsQ0FBQztBQU92RTs7OztHQUlHO0FBQ0gsU0FBZ0IsV0FBVztJQUN6QixNQUFNLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUUsR0FBRyxJQUFBLCtCQUFvQixHQUFFLENBQUM7SUFDN0QsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLElBQUksU0FBUyxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUUsQ0FBQztBQUM1RCxDQUFDO0FBRUQsU0FBZ0IsY0FBYztJQUM1QixPQUFPLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN2QyxDQUFDO0FBRU0sS0FBSyxVQUFVLGNBQWMsQ0FDbEMsUUFBdUIsRUFDdkIsSUFBeUI7SUFFekIsTUFBTSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsWUFBWSxFQUFFLEdBQUcsV0FBVyxFQUFFLENBQUM7SUFDdEQsTUFBTSxLQUFLLEdBQUcsSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsSUFBSSxZQUFZLENBQUM7SUFDbEQsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ1osTUFBTSxJQUFJLHNCQUFjLENBQ3RCLHVEQUF1RCxFQUN2RCxHQUFHLENBQ0osQ0FBQztJQUNKLENBQUM7SUFFRCxJQUFJLEdBQWEsQ0FBQztJQUNsQixJQUFJLENBQUM7UUFDSCxHQUFHLEdBQUcsTUFBTSxLQUFLLENBQUMsY0FBYyxFQUFFO1lBQ2hDLE1BQU0sRUFBRSxNQUFNO1lBQ2QsT0FBTyxFQUFFO2dCQUNQLGFBQWEsRUFBRSxVQUFVLE1BQU0sRUFBRTtnQkFDakMsY0FBYyxFQUFFLGtCQUFrQjtnQkFDbEMsb0VBQW9FO2dCQUNwRSxjQUFjLEVBQUUsSUFBQSwrQkFBb0IsR0FBRSxDQUFDLE9BQU87Z0JBQzlDLFNBQVMsRUFBRSwwQkFBMEI7YUFDdEM7WUFDRCxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQztnQkFDbkIsS0FBSztnQkFDTCxRQUFRO2dCQUNSLFdBQVcsRUFBRSxHQUFHO2dCQUNoQixVQUFVLEVBQUUsSUFBSTtnQkFDaEIsb0VBQW9FO2dCQUNwRSx5REFBeUQ7Z0JBQ3pELGVBQWUsRUFBRSxFQUFFLElBQUksRUFBRSxhQUFhLEVBQUU7YUFDekMsQ0FBQztTQUNILENBQUMsQ0FBQztJQUNMLENBQUM7SUFBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO1FBQ2IsTUFBTSxJQUFJLHNCQUFjLENBQ3RCLHVDQUF3QyxHQUFhLENBQUMsT0FBTyxFQUFFLEVBQy9ELEdBQUcsQ0FDSixDQUFDO0lBQ0osQ0FBQztJQUVELElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLENBQUM7UUFDWixNQUFNLElBQUksR0FBRyxNQUFNLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDOUMsTUFBTSxJQUFJLHNCQUFjLENBQ3RCLHdCQUF3QixHQUFHLENBQUMsTUFBTSxLQUFLLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUFFLEVBQzNELEdBQUcsQ0FDSixDQUFDO0lBQ0osQ0FBQztJQUVELE1BQU0sSUFBSSxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUV4QyxDQUFDO0lBRVQsTUFBTSxPQUFPLEdBQUcsSUFBSSxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUM7SUFDckQsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ2IsTUFBTSxJQUFJLHNCQUFjLENBQUMsMENBQTBDLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDNUUsQ0FBQztJQUNELE9BQU8sT0FBTyxDQUFDO0FBQ2pCLENBQUMifQ==