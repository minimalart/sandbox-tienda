const crypto = require('node:crypto');

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
function appJwt() {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iat: now - 60, exp: now + 540, iss: process.env.GITHUB_APP_ID })}`;
  const key = (process.env.GITHUB_APP_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  return `${unsigned}.${crypto.sign('RSA-SHA256', Buffer.from(unsigned), key).toString('base64url')}`;
}
async function github(path, token, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, { ...options, headers: {
    accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'x-github-api-version': '2022-11-28',
    'content-type': 'application/json', ...(options.headers || {}),
  } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${data.message || path}`);
  return data;
}
async function installationToken(id) {
  const data = await github(`/app/installations/${id}/access_tokens`, appJwt(), { method: 'POST' });
  return data.token;
}
function mergeMiddlewareRegistry(content, definitions = []) {
  if (!definitions.length) return content;
  const importLines = definitions.map(([modulePath, exportName]) => `import { ${exportName} } from '${modulePath}';`);
  const spreadLines = definitions.map(([, exportName]) => `  ...${exportName},`);
  const lines = content.split(/\r?\n/);
  const exportIndex = lines.findIndex((line) => line.startsWith('export const extensionMiddlewares'));
  if (exportIndex < 0) throw new Error('Invalid extension middleware registry');
  for (const line of importLines) if (!lines.includes(line)) lines.splice(exportIndex, 0, line);
  const endIndex = lines.findIndex((line, index) => index >= exportIndex && line.trim() === '];');
  if (endIndex < 0) throw new Error('Invalid extension middleware registry');
  for (const line of spreadLines) if (!lines.includes(line)) lines.splice(endIndex, 0, line);
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}
function mergeAdminHookIndex(content, hooks = []) {
  const lines = content.split(/\r?\n/).filter(Boolean);
  for (const hook of hooks) {
    const line = `export * from './${hook}';`;
    if (!lines.includes(line)) lines.push(line);
  }
  return `${lines.sort().join('\n')}\n`;
}
function mergeAdminI18n(content, definition) {
  if (!definition) return content;
  const [folder, namespace] = definition;
  const lines = content.split(/\r?\n/);
  const importLine = `import { en as ${namespace}En, es as ${namespace}Es } from '../translations/${folder}';`;
  if (!lines.includes(importLine)) {
    const widgetsImportIndex = lines.findIndex((line) => line.includes("../translations/widgets"));
    if (widgetsImportIndex < 0) throw new Error('Invalid Admin translation registry');
    lines.splice(widgetsImportIndex, 0, importLine);
  }
  for (const [language, suffix] of [['en', 'En'], ['es', 'Es']]) {
    const blockIndex = lines.findIndex((line) => line.trim() === `${language}: {`);
    if (blockIndex < 0) throw new Error(`Invalid Admin ${language} translation registry`);
    const entry = `    ${namespace}: ${namespace}${suffix},`;
    if (!lines.includes(entry)) {
      const widgetsIndex = lines.findIndex((line, index) =>
        index > blockIndex && line.trim() === `widgets: widgets${suffix},`
      );
      if (widgetsIndex < 0) throw new Error(`Invalid Admin ${language} translation registry`);
      lines.splice(widgetsIndex, 0, entry);
    }
  }
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}
async function createPullRequest(project, change) {
  const token = await installationToken(project.github_installation_id);
  const repo = `/repos/${project.github_owner}/${project.github_repo}`;
  const base = await github(`${repo}/git/ref/heads/${project.default_branch}`, token);
  const branch = `mercatto/${change.action}-${change.component_id}-${change.id.slice(0, 8)}`;
  const lockFile = await github(`${repo}/contents/mercatto.lock.json?ref=${encodeURIComponent(project.default_branch)}`, token);
  const lock = JSON.parse(Buffer.from(lockFile.content, 'base64').toString('utf8'));
  for (const file of lock.managed_files || []) {
    const current = await github(`${repo}/contents/${file.path}?ref=${encodeURIComponent(project.default_branch)}`, token);
    const content = Buffer.from(current.content, 'base64');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    if (hash !== file.sha256) throw new Error(`Managed file was customized: ${file.path}`);
  }
  const sourceOwner = process.env.MERCATTO_SOURCE_OWNER;
  const sourceRepoName = process.env.MERCATTO_SOURCE_REPO;
  if (!sourceOwner || !sourceRepoName || !lock.source?.commit) throw new Error('Immutable source repository is not configured');
  const sourceToken = process.env.MERCATTO_SOURCE_TOKEN || token;
  const sourceRepo = `/repos/${sourceOwner}/${sourceRepoName}`;
  const kind = change.action === 'switch-template' ? 'templates' : 'extensions';
  const manifestPath = `packages/${kind}/${change.component_id}/mercatto-component.json`;
  const manifestFile = await github(`${sourceRepo}/contents/${manifestPath}?ref=${lock.source.commit}`, sourceToken);
  const manifest = JSON.parse(Buffer.from(manifestFile.content, 'base64').toString('utf8'));
  if (change.target_version && manifest.version !== change.target_version) throw new Error(`Source version is ${manifest.version}, not ${change.target_version}`);
  const sourceTree = await github(`${sourceRepo}/git/trees/${lock.source.commit}?recursive=1`, sourceToken);
  const targetCommit = await github(`${repo}/git/commits/${base.object.sha}`, token);
  const treeEntries = [];
  const managed = new Map((lock.managed_files || []).map((file) => [file.path, file]));
  for (const mapping of manifest.files || []) {
    const prefix = `packages/${kind}/${change.component_id}/${mapping.source}`;
    const matches = sourceTree.tree.filter((entry) => entry.type === 'blob' && (entry.path === prefix || entry.path.startsWith(`${prefix}/`)));
    if (matches.length === 0) throw new Error(`Component source is empty: ${mapping.source}`);
    for (const entry of matches) {
      const blob = await github(`${sourceRepo}/git/blobs/${entry.sha}`, sourceToken);
      const bytes = Buffer.from(blob.content.replace(/\n/g, ''), blob.encoding || 'base64');
      const created = await github(`${repo}/git/blobs`, token, { method: 'POST', body: JSON.stringify({ content: bytes.toString('base64'), encoding: 'base64' }) });
      const suffix = entry.path === prefix ? '' : entry.path.slice(prefix.length + 1);
      const targetPath = suffix ? `${mapping.target}/${suffix}` : mapping.target;
      treeEntries.push({ path: targetPath, mode: entry.mode || '100644', type: 'blob', sha: created.sha });
      managed.set(targetPath, { path: targetPath, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
    }
  }
  if (kind === 'extensions' && manifest.integrations?.middlewares?.length) {
    const registryPath = 'apps/backend/src/api/extension-middlewares.ts';
    const current = await github(`${repo}/contents/${registryPath}?ref=${encodeURIComponent(project.default_branch)}`, token);
    const updated = Buffer.from(mergeMiddlewareRegistry(
      Buffer.from(current.content, 'base64').toString('utf8'),
      manifest.integrations.middlewares
    ));
    const created = await github(`${repo}/git/blobs`, token, { method: 'POST', body: JSON.stringify({
      content: updated.toString('base64'), encoding: 'base64',
    }) });
    treeEntries.push({ path: registryPath, mode: '100644', type: 'blob', sha: created.sha });
    managed.set(registryPath, { path: registryPath, sha256: crypto.createHash('sha256').update(updated).digest('hex') });
  }
  if (kind === 'extensions' && manifest.integrations?.admin_hooks?.length) {
    const hookIndexPath = 'apps/backend/src/admin/hooks/api/index.ts';
    const current = await github(`${repo}/contents/${hookIndexPath}?ref=${encodeURIComponent(project.default_branch)}`, token);
    const updated = Buffer.from(mergeAdminHookIndex(
      Buffer.from(current.content, 'base64').toString('utf8'),
      manifest.integrations.admin_hooks
    ));
    const created = await github(`${repo}/git/blobs`, token, { method: 'POST', body: JSON.stringify({
      content: updated.toString('base64'), encoding: 'base64',
    }) });
    treeEntries.push({ path: hookIndexPath, mode: '100644', type: 'blob', sha: created.sha });
    managed.set(hookIndexPath, { path: hookIndexPath, sha256: crypto.createHash('sha256').update(updated).digest('hex') });
  }
  if (kind === 'extensions' && manifest.integrations?.admin_translation) {
    const translationIndexPath = 'apps/backend/src/admin/i18n/index.ts';
    const current = await github(`${repo}/contents/${translationIndexPath}?ref=${encodeURIComponent(project.default_branch)}`, token);
    const updated = Buffer.from(mergeAdminI18n(
      Buffer.from(current.content, 'base64').toString('utf8'),
      manifest.integrations.admin_translation
    ));
    const created = await github(`${repo}/git/blobs`, token, { method: 'POST', body: JSON.stringify({
      content: updated.toString('base64'), encoding: 'base64',
    }) });
    treeEntries.push({ path: translationIndexPath, mode: '100644', type: 'blob', sha: created.sha });
    managed.set(translationIndexPath, { path: translationIndexPath, sha256: crypto.createHash('sha256').update(updated).digest('hex') });
  }
  if (kind === 'templates') lock.template = { id: manifest.id, version: manifest.version };
  else {
    const installed = (lock.extensions || []).filter((item) => item.id !== manifest.id);
    installed.push({ id: manifest.id, version: manifest.version, status: 'ready', active: true });
    lock.extensions = installed.sort((left, right) => left.id.localeCompare(right.id));
  }
  lock.managed_files = [...managed.values()].sort((left, right) => left.path.localeCompare(right.path));
  lock.source.commit = lock.source.commit;
  lock.last_change = { id: change.id, action: change.action, component_id: change.component_id, applied_at: new Date().toISOString() };
  const lockBlob = await github(`${repo}/git/blobs`, token, { method: 'POST', body: JSON.stringify({ content: `${JSON.stringify(lock, null, 2)}\n`, encoding: 'utf-8' }) });
  treeEntries.push({ path: 'mercatto.lock.json', mode: '100644', type: 'blob', sha: lockBlob.sha });
  const tree = await github(`${repo}/git/trees`, token, { method: 'POST', body: JSON.stringify({ base_tree: targetCommit.tree.sha, tree: treeEntries }) });
  const commit = await github(`${repo}/git/commits`, token, { method: 'POST', body: JSON.stringify({
    message: `chore(mercatto): ${change.action} ${change.component_id}`,
    tree: tree.sha, parents: [base.object.sha],
  }) });
  await github(`${repo}/git/refs`, token, { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }) });
  const pr = await github(`${repo}/pulls`, token, { method: 'POST', body: JSON.stringify({
    title: `Mercatto: ${change.action} ${change.component_id}`,
    head: branch, base: project.default_branch,
    body: 'Generated by Mercatto Platform. CI must pass and a person must review and merge this pull request.',
  }) });
  return { branch, url: pr.html_url };
}
module.exports = { createPullRequest, mergeAdminHookIndex, mergeAdminI18n, mergeMiddlewareRegistry };
