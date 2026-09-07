#!/usr/bin/env node

// DigitalOcean buildea apps/backend con el buildpack de Node, que corre `npm ci`
// cuando encuentra apps/backend/package-lock.json. `npm ci` aborta si el lock no
// está en sincronía con el package.json, así que un lock desactualizado no da un
// warning: rompe el deploy de producción.
//
// Este chequeo compara offline lo que el package.json declara contra lo que el
// lock registra para el paquete raíz — que es lo primero que valida `npm ci` — y
// no necesita red ni node_modules, así que puede correr en CI.
//
// Si falla: cd apps/backend && npm install --package-lock-only

const fs = require('fs');
const path = require('path');

const backend = path.resolve(__dirname, '..', 'apps', 'backend');
const manifestPath = path.join(backend, 'package.json');
const lockPath = path.join(backend, 'package-lock.json');

const problems = [];
if (!fs.existsSync(lockPath)) {
  problems.push('falta apps/backend/package-lock.json: sin él DigitalOcean vuelve a `npm install` sin lock');
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  if (!(lock.lockfileVersion >= 2)) {
    problems.push(`lockfileVersion ${lock.lockfileVersion}: se necesita 2 o más para que \`npm ci\` tenga el árbol completo`);
  }
  if (lock.name !== manifest.name) problems.push(`name: package.json ${manifest.name} vs lock ${lock.name}`);
  if (lock.version !== manifest.version) problems.push(`version: package.json ${manifest.version} vs lock ${lock.version}`);

  // El lock guarda las dependencias declaradas del paquete raíz en packages[""].
  // Cualquier diferencia contra el package.json es exactamente lo que hace
  // fallar a `npm ci` con "package.json and package-lock.json are not in sync".
  const root = (lock.packages || {})[''] || {};
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    const declared = manifest[field] || {};
    const locked = root[field] || {};
    for (const [name, range] of Object.entries(declared)) {
      if (!(name in locked)) problems.push(`${field}: el lock no tiene ${name}`);
      else if (locked[name] !== range) problems.push(`${field}: ${name} es ${range} en package.json y ${locked[name]} en el lock`);
    }
    for (const name of Object.keys(locked)) {
      if (!(name in declared)) problems.push(`${field}: el lock tiene ${name}, que el package.json ya no declara`);
    }
  }
}

if (problems.length) {
  problems.forEach((problem) => console.error(problem));
  console.error('\nRegenerar con: cd apps/backend && npm install --package-lock-only');
  process.exit(1);
}
console.log('apps/backend/package-lock.json en sincronía con su package.json.');
