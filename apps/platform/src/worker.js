const { pool } = require('./db');
const { createPullRequest } = require('./github');

async function claim() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT c.*,p.github_owner,p.github_repo,p.github_installation_id,p.default_branch
      FROM platform_change_request c JOIN platform_project p ON p.id=c.project_id
      WHERE c.status='queued' AND c.available_at<=NOW() ORDER BY c.created_at FOR UPDATE SKIP LOCKED LIMIT 1`);
    if (!rows[0]) { await client.query('COMMIT'); return null; }
    await client.query(`UPDATE platform_change_request SET status='running',attempts=attempts+1,updated_at=NOW() WHERE id=$1`, [rows[0].id]);
    await client.query('COMMIT'); return rows[0];
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
async function tick() {
  const change = await claim(); if (!change) return;
  try {
    const pr = await createPullRequest(change, change);
    await pool.query(`UPDATE platform_change_request SET status='pr_open',branch_name=$2,pull_request_url=$3,updated_at=NOW() WHERE id=$1`, [change.id, pr.branch, pr.url]);
  } catch (error) {
    const customized = String(error.message).startsWith('Managed file was customized:');
    await pool.query(`UPDATE platform_change_request SET status=$2,error=$3,updated_at=NOW() WHERE id=$1`, [change.id, customized ? 'blocked' : 'failed', String(error.message)]);
  }
}
setInterval(() => void tick().catch(console.error), 3000); void tick().catch(console.error);

