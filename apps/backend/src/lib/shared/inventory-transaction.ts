/** Medusa 2.18 bridge: ledger writes share the inventory module transaction. */
export async function inventoryTransaction(
  container: any,
  keys: string[],
  work: (db: any, adjust: (changes: any[]) => Promise<void>) => Promise<unknown>
) {
  const inventory = container.resolve('inventory');
  if (!inventory.baseRepository_?.transaction)
    throw new Error('El host no soporta transacciones de inventario para marketplaces.');
  return container.resolve('locking').execute(keys, () =>
    inventory.baseRepository_.transaction(async (manager: any) => {
      const db = manager.getTransactionContext();
      if (!db) throw new Error('No se pudo abrir una transacción de inventario.');
      return work(db, async (changes) => {
        await inventory.adjustInventory(changes, undefined, undefined, {
          transactionManager: manager,
        });
      });
    })
  );
}
