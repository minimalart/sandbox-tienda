import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260908180000DemoStore extends Migration {
  override async up(): Promise<void> {
    this.addSql(`CREATE TABLE IF NOT EXISTS site_checkout_cart_context (cart_id text PRIMARY KEY, site_id text NOT NULL REFERENCES demo_store(id), mode text NOT NULL CHECK (mode IN ('b2c','b2b')), access_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());`);
    this.addSql(`CREATE TABLE IF NOT EXISTS site_checkout_session (
      cart_id text PRIMARY KEY, site_id text NOT NULL REFERENCES demo_store(id),
      policy jsonb NOT NULL, policy_version text NOT NULL, access_hash text NOT NULL,
      revision integer NOT NULL DEFAULT 0, fingerprint text NOT NULL,
      people jsonb NOT NULL DEFAULT '[]', units jsonb NOT NULL DEFAULT '[]',
      global_person_id text, snapshot_id text, finalizing boolean NOT NULL DEFAULT false,
      mutation_token text, mutation_until timestamptz,
      expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    );`);
    this.addSql(`CREATE TABLE IF NOT EXISTS site_checkout_snapshot (
      id text PRIMARY KEY, cart_id text NOT NULL, site_id text NOT NULL REFERENCES demo_store(id),
      policy jsonb NOT NULL, policy_version text NOT NULL, revision integer NOT NULL,
      fingerprint text NOT NULL, people jsonb NOT NULL, units jsonb NOT NULL,
      expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(cart_id, revision)
    );`);
    this.addSql('CREATE INDEX IF NOT EXISTS site_checkout_snapshot_cart_idx ON site_checkout_snapshot(cart_id);');
    this.addSql('CREATE INDEX IF NOT EXISTS site_checkout_session_expiry_idx ON site_checkout_session(expires_at);');
    this.addSql('CREATE TABLE IF NOT EXISTS site_checkout_access_log (id bigserial PRIMARY KEY, actor_id text NOT NULL, site_id text NOT NULL, order_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());');
  }
  override async down(): Promise<void> {
    // Checkout and order history must survive application rollback.
  }
}
