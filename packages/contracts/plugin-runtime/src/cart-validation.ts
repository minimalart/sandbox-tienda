type Handler = (input: any, context: any) => Promise<any>;
type Entry = { invoke: Handler; compensate?: Handler };
const registryKey = Symbol.for('mercatto.cart-validation.handlers.v1');
const globalRegistry = globalThis as typeof globalThis & { [registryKey]?: WeakMap<object, Map<string, Entry>> };
const registry = globalRegistry[registryKey] ??= new WeakMap();

/** Compose optional validators into Medusa's single validate hook. */
export function registerCartValidation(
  workflow: { hooks: { validate: (invoke: Handler, compensate: Handler) => void } },
  id: string,
  invoke: Handler,
  compensate: Handler | undefined,
  response: (compensation: Array<{ id: string; data: any }>) => any,
) {
  const hook = workflow.hooks.validate;
  let entries = registry.get(hook);
  if (!entries) {
    entries = new Map();
    registry.set(hook, entries);
    const handlers = entries;
    const undo: Handler = async (completed, context) => {
      const errors: unknown[] = [];
      for (const item of [...(completed ?? [])].reverse()) {
        try { await handlers.get(item.id)?.compensate?.(item.data, context); }
        catch (error) { errors.push(error); }
      }
      if (errors.length) throw new AggregateError(errors, 'Cart validation compensation failed');
    };
    try {
      hook(async (input, context) => {
        const completed: Array<{ id: string; data: any }> = [];
        try {
          for (const [key, entry] of handlers) completed.push({ id: key, data: await entry.invoke(input, context) });
          return response(completed);
        } catch (error) {
          try { await undo(completed, context); }
          catch (rollback) { throw new AggregateError([error, rollback], 'Cart validation and compensation failed'); }
          throw error;
        }
      }, undo);
    } catch (error) { registry.delete(hook); throw error; }
  }
  if (entries.has(id)) throw new Error('Duplicate cart validator: ' + id);
  entries.set(id, { invoke, compensate });
}
