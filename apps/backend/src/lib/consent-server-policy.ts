/** A persisted client_id is not evidence of current visitor consent. */
export function permitsUnattributedServerEvent(config: unknown): boolean {
  const value = config as { enabled?: boolean; mode?: string } | null;
  return !value?.enabled || value.mode === 'informational';
}
