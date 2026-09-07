const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pool } = require('./db');
const { hashSecret, safeEqual, verifyWebhook } = require('./security');

const port = Number(process.env.PORT || 4100);
const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const readBody = (req) => new Promise((resolve, reject) => { const chunks = []; req.on('data', (chunk) => chunks.push(chunk)); req.on('end', () => resolve(Buffer.concat(chunks))); req.on('error', reject); });
async function authenticate(req) {
  const id = req.headers['x-mercatto-project-id']; const secret = req.headers['x-mercatto-project-secret'];
  if (!id || !secret) return null;
  const { rows } = await pool.query('SELECT * FROM platform_project WHERE id=$1', [id]);
  return rows[0] && safeEqual(rows[0].secret_hash, hashSecret(String(secret))) ? rows[0] : null;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true });
    const raw = await readBody(req); const body = raw.length ? JSON.parse(raw.toString('utf8')) : {};
    if (req.method === 'POST' && req.url === '/v1/projects') {
      if (req.headers.authorization !== `Bearer ${process.env.PLATFORM_ADMIN_TOKEN}`) return json(res, 401, { message: 'Unauthorized' });
      const secret = crypto.randomBytes(32).toString('base64url');
      await pool.query(`INSERT INTO platform_project(id,name,secret_hash,github_owner,github_repo,github_installation_id,default_branch)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name, secret_hash=EXCLUDED.secret_hash, github_owner=EXCLUDED.github_owner, github_repo=EXCLUDED.github_repo, github_installation_id=EXCLUDED.github_installation_id, default_branch=EXCLUDED.default_branch, updated_at=NOW()`,
        [body.id, body.name, hashSecret(secret), body.github_owner, body.github_repo, body.github_installation_id, body.default_branch || 'main']);
      return json(res, 201, { project_id: body.id, project_secret: secret });
    }
    if (req.method === 'GET' && req.url === '/v1/catalog') {
      const file = path.resolve(__dirname, '../../../packages/project-catalog/src/catalog.json');
      return json(res, 200, JSON.parse(fs.readFileSync(file, 'utf8')));
    }
    if (req.method === 'GET' && req.url === '/v1/change-requests') {
      const project = await authenticate(req); if (!project) return json(res, 401, { message: 'Unauthorized' });
      const { rows } = await pool.query(`SELECT id,action,component_id,target_version,status,branch_name,pull_request_url,error,created_at,updated_at FROM platform_change_request WHERE project_id=$1 ORDER BY created_at DESC LIMIT 50`, [project.id]);
      return json(res, 200, { change_requests: rows });
    }
    if (req.method === 'POST' && req.url === '/v1/change-requests') {
      const project = await authenticate(req); if (!project) return json(res, 401, { message: 'Unauthorized' });
      if (!['install','update','switch-template'].includes(body.action) || !/^[a-z0-9-]+$/.test(body.component_id || '')) return json(res, 400, { message: 'Invalid request' });
      const id = crypto.randomUUID();
      await pool.query('INSERT INTO platform_change_request(id,project_id,action,component_id,target_version) VALUES($1,$2,$3,$4,$5)', [id, project.id, body.action, body.component_id, body.target_version || null]);
      await pool.query('INSERT INTO platform_audit_log(project_id,change_request_id,event,data) VALUES($1,$2,$3,$4)', [project.id, id, 'queued', body]);
      return json(res, 202, { id, status: 'queued' });
    }
    if (req.method === 'POST' && req.url === '/v1/github/webhook') {
      if (!verifyWebhook(raw, String(req.headers['x-hub-signature-256'] || ''))) return json(res, 401, { message: 'Invalid signature' });
      if (req.headers['x-github-event'] === 'pull_request' && body.action === 'closed' && body.pull_request?.merged) {
        await pool.query(`UPDATE platform_change_request SET status='merged',updated_at=NOW() WHERE pull_request_url=$1`, [body.pull_request.html_url]);
      }
      return json(res, 202, { accepted: true });
    }
    return json(res, 404, { message: 'Not found' });
  } catch (error) { console.error(error); return json(res, 500, { message: error.message }); }
});
server.listen(port, () => console.log(`Mercatto Platform listening on ${port}`));
