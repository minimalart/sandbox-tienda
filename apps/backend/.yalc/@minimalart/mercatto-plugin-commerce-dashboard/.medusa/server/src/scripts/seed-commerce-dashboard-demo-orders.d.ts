/**
 * Crea órdenes REALES para poblar el Commerce Dashboard.
 *
 * - Usa el workflow nativo `createOrderWorkflow` → cada orden queda con su
 *   `order_summary` (totales reales), por eso el dashboard las suma bien y
 *   cuentan como ventas genuinas.
 * - Llevan una marca interna OCULTA `metadata.commerce_dashboard_seed: true`
 *   (no se muestra al cliente) que solo sirve para trazarlas/limpiarlas luego.
 * - Idempotente: no crea si ya existen N órdenes con esa marca.
 * - Distribuye `created_at` en los últimos N días (backdate vía knex).
 *
 * Reutilizable: `seedCommerceDashboardOrders(container, opts)` lo invoca tanto
 * este script CLI como la ruta admin `POST /admin/commerce-dashboard/seed-orders`
 * (la DB de prod tiene Trusted Sources, así que no se puede correr desde fuera
 * del server).
 *
 * Uso CLI (con DATABASE_URL real):
 *   pnpm --filter @repo/backend exec medusa exec ./src/scripts/seed-commerce-dashboard-demo-orders.ts
 *
 * Config (env):
 *   COMMERCE_DASHBOARD_SEED_PURCHASES=20
 *   COMMERCE_DASHBOARD_SEED_CURRENCY=ars
 *   COMMERCE_DASHBOARD_SEED_COUNTRY=ar
 */
import type { ExecArgs, MedusaContainer } from '@medusajs/framework/types';
export type SeedOrdersOptions = {
    purchases?: number;
    currency?: string;
    country?: string;
};
export type SeedOrdersResult = {
    created: number;
    already: number;
    target: number;
    currency: string;
    country: string;
};
/**
 * Lógica reutilizable de seed. Devuelve cuántas órdenes creó.
 */
export declare function seedCommerceDashboardOrders(container: MedusaContainer, opts?: SeedOrdersOptions): Promise<SeedOrdersResult>;
export default function seedDemoOrders({ container }: ExecArgs): Promise<void>;
