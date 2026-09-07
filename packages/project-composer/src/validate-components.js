const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const definitions = require('./component-definitions');
const { catalog } = require('../../project-catalog/src');

const root = path.resolve(__dirname, '../../..');
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const errors = [];
const owners = new Map();

for (const extension of catalog.extensions) {
  const packageRoot = path.join(root, 'packages', 'extensions', extension.id);
  const manifestPath = path.join(packageRoot, 'mercatto-component.json');
  if (!fs.existsSync(manifestPath)) {
    errors.push(`${extension.id}: missing mercatto-component.json`);
    continue;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.id !== extension.id || manifest.version !== extension.version) {
    errors.push(`${extension.id}: catalog and component identity differ`);
  }
  if (JSON.stringify(manifest.dependencies || []) !== JSON.stringify(extension.dependencies || [])) {
    errors.push(`${extension.id}: catalog and component dependencies differ`);
  }
  for (const mapping of manifest.files || []) {
    const previous = owners.get(mapping.target);
    if (previous && previous !== extension.id) errors.push(`${mapping.target}: owned by ${previous} and ${extension.id}`);
    owners.set(mapping.target, extension.id);
    const payload = path.join(packageRoot, mapping.source);
    const canonical = path.join(root, mapping.target);
    if (!fs.existsSync(payload)) errors.push(`${extension.id}: payload missing ${mapping.source}`);
    if (!fs.existsSync(canonical)) errors.push(`${extension.id}: canonical source missing ${mapping.target}`);
  }
  for (const managed of manifest.managed_files || []) {
    const file = path.join(packageRoot, 'payload', managed.path);
    if (!fs.existsSync(file) || sha256(file) !== managed.sha256) {
      errors.push(`${extension.id}: stale payload hash ${managed.path}`);
    }
  }
}

for (const extension of catalog.extensions) {
  if (!definitions[extension.id]) errors.push(`${extension.id}: missing ownership definition`);
}
if (catalog.extensions.some((extension) => extension.id === 'demo-creator')) {
  errors.push('demo-creator must not be installable in generated projects');
}

if (errors.length) {
  errors.forEach((error) => console.error(error));
  process.exit(1);
}
console.log(`Validated ${catalog.extensions.length} independently extracted extensions.`);
