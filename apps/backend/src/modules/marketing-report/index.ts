import { Module } from '@medusajs/framework/utils';
// Durable report cache; request-scoped helpers use the host PG connection.
class MarketingReportService {}
export default Module('marketingReport', { service: MarketingReportService });
