import { register } from 'node:module';

// Registra el resolve hook (extensionless → .ts/.tsx/index.ts) para `node --test`.
register('./test-resolve-hook.mjs', import.meta.url);
