// Copia el catálogo canónico al espejo del backend.
//
// El backend en producción (DO) y los proyectos generados no incluyen
// packages/project-catalog en el filesystem, así que el runtime lee el espejo
// apps/backend/src/lib/platform/catalog.json. `validate.js` falla si el
// espejo quedó desactualizado; este script lo regenera.
const fs = require('node:fs');
const path = require('node:path');

const canonical = path.resolve(__dirname, 'catalog.json');
const mirror = path.resolve(__dirname, '../../../apps/backend/src/lib/platform/catalog.json');

fs.copyFileSync(canonical, mirror);
console.log(`Mirror updated: ${path.relative(process.cwd(), mirror)}`);
