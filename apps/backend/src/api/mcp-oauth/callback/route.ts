import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { AI_ASSISTANT_MODULE } from '../../../modules/ai-assistant';
import { completeOAuth } from '../../../modules/ai-assistant/ai/mcp-oauth';

type AiService = any;

/**
 * GET /mcp-oauth/callback — callback público del flujo OAuth de servidores MCP
 * externos. NO va bajo /admin: la redirección del Authorization Server es una
 * navegación top-level del navegador sin el Bearer del admin. La seguridad la da
 * el `state` de alta entropía (single-use, persistido cifrado en `oauth_pending`).
 */
function page(ok: boolean, message: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MCP OAuth</title></head><body style="font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;background:#f6f6f5"><div style="max-width:420px;padding:28px;border:1px solid #e5e5e3;border-radius:12px;background:#fff;text-align:center"><div style="font-size:30px;line-height:1">${ok ? '✅' : '⚠️'}</div><p style="font-size:15px;color:#1c1c1a;margin:12px 0 4px">${message}</p><p style="font-size:13px;color:#6b6b66;margin:0">Ya podés cerrar esta pestaña y volver al backoffice.</p></div><script>try{window.opener&&window.opener.postMessage({type:'mcp-oauth',ok:${ok ? 'true' : 'false'}},'*')}catch(e){}setTimeout(function(){try{window.close()}catch(e){}},1800)</script></body></html>`;
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const code = String((req.query.code as string) ?? '').trim();
  const state = String((req.query.state as string) ?? '').trim();
  const sendHtml = (status: number, html: string) => {
    res.status(status);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // MedusaResponse extiende el Response de Express; `send` existe en runtime.
    (res as unknown as { send: (b: string) => void }).send(html);
  };

  if (!code || !state) {
    sendHtml(400, page(false, 'Faltan parámetros (code/state) en la respuesta del servidor.'));
    return;
  }

  const service: AiService = req.scope.resolve(AI_ASSISTANT_MODULE);
  const result = await completeOAuth(service, state, code);
  if (!result.ok) {
    sendHtml(400, page(false, `No se pudo completar la conexión OAuth: ${result.error ?? ''}`));
    return;
  }
  sendHtml(200, page(true, `Conectado a “${result.serverName ?? 'servidor MCP'}”.`));
};
