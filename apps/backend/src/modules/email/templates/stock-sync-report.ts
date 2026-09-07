import type { EmailTemplateFunction, EmailTemplateResult } from './types';

export type StockSyncReportData = {
  status: 'success' | 'error';
  started_at?: string;
  finished_at?: string;
  duration_seconds?: number;
  total_crm?: number;
  matched?: number;
  updated?: number;
  created_levels?: number;
  errors_count?: number;
  not_found_count?: number;
  affected_products_count?: number;
  location_id?: string;
  not_found_skus_sample?: string[];
  errors_sample?: Array<{ sku: string; error: string }>;
  error_message?: string;
  [key: string]: unknown;
};

export const stockSyncReportTemplate: EmailTemplateFunction<StockSyncReportData> = (
  data
): EmailTemplateResult => {
  const isError = data.status === 'error';
  const statusLabel = isError ? 'Falló' : 'OK';
  const statusColor = isError ? '#cc0000' : '#1b9c4f';
  const subject = `[Sync Stock] ${statusLabel} — ${data.finished_at ?? new Date().toISOString()}`;

  const row = (label: string, value: string | number | undefined) => `
    <tr>
      <td style="padding: 6px 12px; color: #666; font-size: 14px; border-bottom: 1px solid #eee;">${label}</td>
      <td style="padding: 6px 12px; color: #333; font-size: 14px; font-weight: 600; border-bottom: 1px solid #eee; text-align: right;">${value ?? '—'}</td>
    </tr>`;

  const notFoundList = (data.not_found_skus_sample || []).slice(0, 20);
  const errorsList = (data.errors_sample || []).slice(0, 20);

  const notFoundBlock = notFoundList.length
    ? `<h3 style="font-size:14px;margin:24px 0 8px 0;color:#333;">SKUs no encontrados (muestra)</h3>
       <pre style="background:#f7f7f7;padding:10px;border-radius:4px;font-size:12px;color:#333;white-space:pre-wrap;word-break:break-all;">${notFoundList.join(', ')}</pre>`
    : '';

  const errorsBlock = errorsList.length
    ? `<h3 style="font-size:14px;margin:24px 0 8px 0;color:#cc0000;">Errores (muestra)</h3>
       <pre style="background:#fff3f3;padding:10px;border-radius:4px;font-size:12px;color:#333;white-space:pre-wrap;">${errorsList.map(e => `${e.sku}: ${e.error}`).join('\n')}</pre>`
    : '';

  const errorBanner = isError && data.error_message
    ? `<div style="background:#fff3f3;border-left:3px solid #cc0000;padding:12px 16px;margin:0 0 16px 0;border-radius:4px;">
         <strong style="color:#cc0000;">Error:</strong>
         <span style="color:#333;">${data.error_message}</span>
       </div>`
    : '';

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>${subject}</title></head>
<body style="margin:0;padding:20px;background:#f5f5f5;font-family:Inter,Arial,sans-serif;">
  <table cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin:auto;background:#fff;max-width:600px;">
    <tr>
      <td style="padding:24px 32px;border-bottom:3px solid ${statusColor};">
        <h1 style="margin:0;font-size:20px;color:#333;">Sync Stock CRM → Medusa</h1>
        <p style="margin:6px 0 0 0;color:${statusColor};font-size:16px;font-weight:600;">${statusLabel}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 32px;">
        ${errorBanner}
        <table cellspacing="0" cellpadding="0" border="0" width="100%">
          ${row('Inicio', data.started_at)}
          ${row('Fin', data.finished_at)}
          ${row('Duración (s)', data.duration_seconds)}
          ${row('Total registros CRM', data.total_crm)}
          ${row('Matcheados', data.matched)}
          ${row('Levels actualizados', data.updated)}
          ${row('Levels creados', data.created_levels)}
          ${row('SKUs sin variante en Medusa', data.not_found_count)}
          ${row('Productos afectados', data.affected_products_count)}
          ${row('Errores', data.errors_count)}
          ${row('Stock Location', data.location_id)}
        </table>
        ${notFoundBlock}
        ${errorsBlock}
      </td>
    </tr>
    <tr>
      <td style="padding:16px 32px;background:#fafafa;color:#999;font-size:12px;text-align:center;">
        Reporte automático del job sync-stock-from-crm.
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  return { subject, html };
};
