import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { findDescriptor } from '../../../../modules/app-settings/descriptors';
import { resolveSettingFor } from '../../../../modules/app-settings/service';
import { cachedReport, reportKey } from '../../../../lib/marketing-report-cache';
import { normalizeClarity, type ClarityReport } from '../../../../lib/clarity-report';
import {
  validateClarity,
  type ClarityConfig,
} from '../../../../modules/app-settings/descriptors/clarity';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const site = await siteFromRequest(req);
  if (site.status === 'unknownSite') return res.status(404).json({ message: 'Unknown site' });
  const config = await resolveSettingFor<ClarityConfig>(
    req.scope,
    findDescriptor('extension:clarity', 'CONFIG')!,
    site
  );
  const token = await resolveSettingFor<string>(
    req.scope,
    findDescriptor('extension:clarity', 'EXPORT_TOKEN')!,
    site
  );
  if (!config?.enabled || validateClarity(config) || !token)
    return res.status(409).json({ message: 'Configure Clarity and its Data Export token first' });
  // Fixed 72-hour report: no arbitrary date/dimension combinations that burn the quota.
  const report = await cachedReport<ClarityReport>(
    req.scope,
    reportKey('clarity', config.projectId, token),
    6 * 3600,
    async () => {
      const base = { fetchedAt: new Date().toISOString(), days: 3, metrics: [] };
      try {
        const response = await fetch(
          'https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=3',
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(20000),
            redirect: 'error',
          }
        );
        if (!response.ok)
          return { ...base, status: response.status === 429 ? 'rate_limited' : 'error' };
        return { ...base, status: 'success', metrics: normalizeClarity(await response.json()) };
      } catch {
        return { ...base, status: 'error' };
      }
    }
  );
  return res.json(report);
}
