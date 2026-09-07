import { register } from 'node:module';

// Registra el resolve hook (extensionless + alias de tsconfig) para `node --test`.
register('./test-resolve-hook.mjs', import.meta.url);
