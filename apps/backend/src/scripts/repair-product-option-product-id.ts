import type { ExecArgs } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

/**
 * Repairs the core `product_option.product_id` column when it has been dropped
 * by an external/manual DB modification (symptom: every product query that
 * expands `options` fails with `column p0.product_id does not exist`, which
 * takes down storefront SSR).
 *
 * SAFE TO RUN ANYWHERE:
 *   - No-op if the column already exists and is NOT NULL (healthy DB).
 *   - Aborts before writing if `product_id` cannot be reconstructed
 *     unambiguously (every live option must map to exactly one product via the
 *     variant → option_value → option graph).
 *   - Transactional, with a timestamped backup of the table.
 *   - Set DRY_RUN=1 to preview the plan without writing.
 *
 * Run:
 *   pnpm --filter @repo/backend exec medusa exec ./src/scripts/repair-product-option-product-id.ts
 *   DRY_RUN=1 pnpm --filter @repo/backend exec medusa exec ./src/scripts/repair-product-option-product-id.ts
 *
 * After confirming the fix, the backup table (product_option_bak_<ts>) can be
 * dropped manually.
 */
export default async function repairProductOptionProductId({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const knex: any = container.resolve('__pg_connection__');

  const dryRun = ['1', 'true', 'yes'].includes(String(process.env.DRY_RUN).toLowerCase());
  const db = (await knex.raw('select current_database() as db')).rows[0].db;
  logger.info(`[repair] database=${db} dryRun=${dryRun}`);

  // --- 0. health check: already fixed? ---
  const col = (
    await knex.raw(
      `select is_nullable from information_schema.columns
       where table_schema='public' and table_name='product_option' and column_name='product_id'`,
    )
  ).rows[0];

  if (col && col.is_nullable === 'NO') {
    logger.info('[repair] product_option.product_id already present and NOT NULL — nothing to do.');
    return;
  }
  logger.info(
    col
      ? '[repair] product_id exists but is NULLABLE — will backfill + harden.'
      : '[repair] product_id is MISSING — will add, backfill, and harden.',
  );

  // --- 1. recoverability pre-checks (read-only) ---
  const live = (
    await knex.raw(`select count(*)::int n from product_option where deleted_at is null`)
  ).rows[0].n;

  const reach = (
    await knex.raw(`
      select
        count(*)::int                              as reachable,
        count(*)::int filter (where n > 1)         as ambiguous
      from (
        select po.id, count(distinct pv.product_id) as n
        from product_option po
        join product_option_value pov on pov.option_id = po.id
        join product_variant_option pvo on pvo.option_value_id = pov.id
        join product_variant pv on pv.id = pvo.variant_id
        where po.deleted_at is null
        group by po.id
      ) t`)
  ).rows[0];

  const dups = (
    await knex.raw(`
      select count(*)::int dups from (
        select pv.product_id, po.title
        from product_option po
        join product_option_value pov on pov.option_id = po.id
        join product_variant_option pvo on pvo.option_value_id = pov.id
        join product_variant pv on pv.id = pvo.variant_id
        where po.deleted_at is null
        group by pv.product_id, po.title
        having count(distinct po.id) > 1
      ) x`)
  ).rows[0].dups;

  logger.info(
    `[repair] live=${live} reachable=${reach.reachable} ambiguous=${reach.ambiguous} dup(product_id,title)=${dups}`,
  );

  if (reach.ambiguous > 0) {
    logger.error('[repair] ABORT: some live options map to multiple products — reconstruction is ambiguous.');
    return;
  }
  if (reach.reachable < live) {
    logger.error(
      `[repair] ABORT: ${live - reach.reachable} live options are unreachable via the variant graph — cannot reconstruct product_id.`,
    );
    return;
  }
  if (dups > 0) {
    logger.error('[repair] ABORT: duplicate (product_id, title) would violate the core unique index.');
    return;
  }

  if (dryRun) {
    logger.info('[repair] DRY_RUN: all checks passed. Re-run without DRY_RUN to apply.');
    return;
  }

  // --- 2. apply (transactional) ---
  await knex.transaction(async (trx: any) => {
    const ts = (await trx.raw(`select to_char(now(),'YYYYMMDD_HH24MISS') as ts`)).rows[0].ts;
    const backup = `product_option_bak_${ts}`;
    await trx.raw(`create table "${backup}" as table product_option`);
    logger.info(`[repair] backup created: ${backup}`);

    await trx.raw(`alter table product_option add column if not exists product_id text`);

    const upd = await trx.raw(`
      update product_option po
      set product_id = m.product_id
      from (
        select pov.option_id, min(pv.product_id) as product_id
        from product_option_value pov
        join product_variant_option pvo on pvo.option_value_id = pov.id
        join product_variant pv on pv.id = pvo.variant_id
        group by pov.option_id
      ) m
      where m.option_id = po.id and po.product_id is null`);
    logger.info(`[repair] backfilled rows: ${upd.rowCount}`);

    const liveNull = (
      await trx.raw(
        `select count(*)::int n from product_option where deleted_at is null and product_id is null`,
      )
    ).rows[0].n;
    if (liveNull > 0) {
      throw new Error(`[repair] ${liveNull} LIVE options still NULL after backfill — rolling back.`);
    }

    // unrecoverable soft-deleted orphans (already deleted): clean up so NOT NULL holds
    const delRes = await trx.raw(
      `delete from product_option where deleted_at is not null and product_id is null`,
    );
    if (delRes.rowCount) logger.info(`[repair] removed ${delRes.rowCount} unrecoverable soft-deleted orphans`);

    await trx.raw(`alter table product_option alter column product_id set not null`);
    await trx.raw(
      `create index if not exists "IDX_product_option_product_id" on product_option (product_id) where deleted_at is null`,
    );
    await trx.raw(
      `create unique index if not exists "IDX_option_product_id_title_unique" on product_option (product_id, title) where deleted_at is null`,
    );
    await trx.raw(`
      do $$ begin
        if not exists (select 1 from pg_constraint where conname = 'product_option_product_id_foreign') then
          alter table product_option
            add constraint product_option_product_id_foreign
            foreign key (product_id) references product(id) on update cascade on delete cascade;
        end if;
      end $$;`);
    logger.info('[repair] product_id set NOT NULL; indexes + FK ensured.');
  });

  // --- 3. verify ---
  try {
    await query.graph({
      entity: 'product',
      fields: ['id', 'options.id', 'options.title', 'options.values.value'],
      pagination: { take: 1 },
    });
    logger.info('[repair] VERIFY OK: product → options query succeeds.');
  } catch (e: any) {
    logger.error(`[repair] VERIFY FAILED: ${e?.message}`);
  }
}
