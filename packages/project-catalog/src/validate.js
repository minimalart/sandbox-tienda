const fs = require('node:fs');
const path = require('node:path');
const { validateCatalog } = require('./index');

const result = validateCatalog();
if (!result.valid) {
  for (const error of result.errors) console.error(error);
  process.exit(1);
}

// El runtime del backend (prod DO y proyectos generados) no tiene
// packages/project-catalog en el filesystem: lee el espejo commiteado en
// apps/backend/src/lib/platform/catalog.json. Acá se exige que no drifteen.
const canonical = fs.readFileSync(path.resolve(__dirname, 'catalog.json'), 'utf8');
const mirrorPath = path.resolve(__dirname, '../../../apps/backend/src/lib/platform/catalog.json');
if (!fs.existsSync(mirrorPath) || JSON.stringify(JSON.parse(canonical)) !== JSON.stringify(JSON.parse(fs.readFileSync(mirrorPath, 'utf8')))) {
  console.error('Backend catalog mirror is stale. Run: node packages/project-catalog/src/sync-backend-mirror.js');
  process.exit(1);
}

console.log('Project catalog is valid.');
