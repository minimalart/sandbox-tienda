/**
 * Standard React Query key factory used across the plugin's admin hooks.
 * Mirrors the host `queryKeysFactory` shape so mutation invalidation lines stay
 * one-to-one with the extension code.
 */
export const queryKeysFactory = <T extends string>(prefix: T) => {
  const all = [prefix] as const;
  return {
    all,
    lists: () => [...all, 'list'] as const,
    list: (query?: Record<string, unknown>) =>
      query ? ([...all, 'list', query] as const) : ([...all, 'list'] as const),
    details: () => [...all, 'detail'] as const,
    detail: (id: string) => [...all, 'detail', id] as const,
  };
};
