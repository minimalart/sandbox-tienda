import type { MedusaRequest } from '@medusajs/framework';
import type DatabaseExplorerModuleService from '../../../modules/database-explorer/service';
export declare function databaseExplorerService(req: MedusaRequest): DatabaseExplorerModuleService;
export declare function actorId(req: MedusaRequest): string | null;
export declare function queryString(value: unknown): string | undefined;
export declare function parseFilters(value: unknown): Record<string, unknown>;
