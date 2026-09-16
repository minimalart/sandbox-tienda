import { registerExternalReader } from '@minimalart/mercatto-plugin-runtime';
import { encryptCredentials, decryptCredentials } from '../lib/multistore/credentials';
import { inventoryTransaction } from '../lib/shared/inventory-transaction';

/** Public runtime port; no plugin imports. Secrets are never returned by admin APIs. */
registerExternalReader('credentials/codec/v1', () => ({
  encrypt(value: Record<string, unknown>) {
    if (!process.env.CREDENTIAL_ENCRYPTION_KEY?.trim())
      throw new Error('Configurá CREDENTIAL_ENCRYPTION_KEY antes de conectar cuentas.');
    return encryptCredentials(value);
  },
  decrypt: decryptCredentials,
}));

/**
 * Medusa 2.18 inventory uses its module EntityManager, not the host Knex manager.
 * Own the version-specific bridge here: callers can atomically persist a ledger
 * with the inventory mutation, without writing Medusa inventory tables themselves.
 */
registerExternalReader('inventory/transaction/v1', () => inventoryTransaction);
