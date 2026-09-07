"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLandingAiSettings = getLandingAiSettings;
const mercatto_plugin_runtime_1 = require("@minimalart/mercatto-plugin-runtime");
const read = (key) => {
    const namespace = ['OPENROUTER_API_KEY', 'OPENROUTER_SITE_URL'].includes(key)
        ? 'extension:ai-assistant'
        : 'extension:landing-pages';
    return (0, mercatto_plugin_runtime_1.getAppSettingsSyncReader)()?.(namespace, key) ?? process.env[key];
};
const readString = (key, fallback) => {
    const raw = read(key);
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    return trimmed === '' ? fallback : trimmed;
};
const readNumber = (key, fallback) => {
    const raw = read(key);
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number.parseFloat(raw) : NaN;
    return Number.isFinite(n) ? n : fallback;
};
function getLandingAiSettings() {
    return {
        apiKey: readString('OPENROUTER_API_KEY', ''),
        model: readString('OPENROUTER_MODEL', 'openai/gpt-4.1-mini'),
        // `Math.max(0, …)` — un valor negativo heredado del entorno se trata como
        // cero, no como un bucle (comportamiento histórico de `getAiConfig()`).
        maxRetries: Math.max(0, readNumber('LANDING_AI_MAX_RETRIES', 2)),
        siteUrl: readString('OPENROUTER_SITE_URL', 'https://mercatto.minimalart.studio'),
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0dGluZ3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9sYW5kaW5nLXBhZ2Uvc2V0dGluZ3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFrQ0Esb0RBU0M7QUEzQ0QsaUZBQStFO0FBZS9FLE1BQU0sSUFBSSxHQUFHLENBQUMsR0FBVyxFQUFXLEVBQUU7SUFDcEMsTUFBTSxTQUFTLEdBQUcsQ0FBQyxvQkFBb0IsRUFBRSxxQkFBcUIsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUM7UUFDM0UsQ0FBQyxDQUFDLHdCQUF3QjtRQUMxQixDQUFDLENBQUMseUJBQXlCLENBQUM7SUFDOUIsT0FBTyxJQUFBLGtEQUF3QixHQUFFLEVBQUUsQ0FBQyxTQUFTLEVBQUUsR0FBRyxDQUFDLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUMxRSxDQUFDLENBQUM7QUFFRixNQUFNLFVBQVUsR0FBRyxDQUFDLEdBQVcsRUFBRSxRQUFnQixFQUFVLEVBQUU7SUFDM0QsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3RCLE1BQU0sT0FBTyxHQUFHLE9BQU8sR0FBRyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFDMUQsT0FBTyxPQUFPLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztBQUM3QyxDQUFDLENBQUM7QUFFRixNQUFNLFVBQVUsR0FBRyxDQUFDLEdBQVcsRUFBRSxRQUFnQixFQUFVLEVBQUU7SUFDM0QsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3RCLE1BQU0sQ0FBQyxHQUFHLE9BQU8sR0FBRyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxPQUFPLEdBQUcsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQztJQUNqRyxPQUFPLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDO0FBQzNDLENBQUMsQ0FBQztBQUVGLFNBQWdCLG9CQUFvQjtJQUNsQyxPQUFPO1FBQ0wsTUFBTSxFQUFFLFVBQVUsQ0FBQyxvQkFBb0IsRUFBRSxFQUFFLENBQUM7UUFDNUMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxrQkFBa0IsRUFBRSxxQkFBcUIsQ0FBQztRQUM1RCwwRUFBMEU7UUFDMUUsd0VBQXdFO1FBQ3hFLFVBQVUsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxVQUFVLENBQUMsd0JBQXdCLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDaEUsT0FBTyxFQUFFLFVBQVUsQ0FBQyxxQkFBcUIsRUFBRSxvQ0FBb0MsQ0FBQztLQUNqRixDQUFDO0FBQ0osQ0FBQyJ9