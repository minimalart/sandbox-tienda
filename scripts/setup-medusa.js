#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const BACKEND_DIR = path.join(__dirname, '../apps/backend');
const ENV_FILE = path.join(BACKEND_DIR, '.env');
const MAX_DB_WAIT_ATTEMPTS = 30;
const DB_CHECK_INTERVAL = 2000;

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  console.log();
  log(`━━━ ${title} ━━━`, colors.bright + colors.cyan);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function execCommand(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
      cwd: options.cwd || BACKEND_DIR,
      ...options,
    });
  } catch (error) {
    if (!options.ignoreError) {
      throw error;
    }
    return null;
  }
}

function loadEnvFile() {
  if (!fs.existsSync(ENV_FILE)) {
    log('⚠️  .env file not found in apps/backend/', colors.red);
    log('Please copy .env.example to .env and configure it:', colors.yellow);
    log('  cp apps/backend/.env.example apps/backend/.env', colors.cyan);
    process.exit(1);
  }

  const envContent = fs.readFileSync(ENV_FILE, 'utf-8');
  const envVars = {};

  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });

  return envVars;
}

async function checkEnvironmentVariables() {
  logSection('Checking Environment Variables');

  const envVars = loadEnvFile();
  const required = ['DATABASE_URL', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'];
  const missing = [];

  for (const key of required) {
    if (!envVars[key] || envVars[key] === '') {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    log('⚠️  Missing required environment variables:', colors.red);
    missing.forEach((key) => log(`   - ${key}`, colors.red));
    log('\nPlease set these variables in apps/backend/.env', colors.yellow);
    process.exit(1);
  }

  log('✓ All required environment variables are set', colors.green);
  return envVars;
}

async function waitForDatabase(databaseUrl) {
  logSection('Waiting for PostgreSQL');

  // Extract connection details from DATABASE_URL
  const urlMatch = databaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!urlMatch) {
    log('⚠️  Invalid DATABASE_URL format', colors.red);
    process.exit(1);
  }

  const [, , , host, port, database] = urlMatch;

  log(`Checking connection to ${host}:${port}/${database}...`, colors.yellow);

  // Plain TCP check — no psql/pg_isready required on the host
  const checkTcp = () =>
    new Promise((resolve, reject) => {
      const socket = require('net').createConnection({ host, port: Number(port) });
      socket.setTimeout(3000);
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('timeout', () => {
        socket.destroy();
        reject(new Error('timeout'));
      });
      socket.once('error', (err) => {
        socket.destroy();
        reject(err);
      });
    });

  for (let attempt = 1; attempt <= MAX_DB_WAIT_ATTEMPTS; attempt++) {
    try {
      await checkTcp();

      log('✓ PostgreSQL is ready', colors.green);
      return true;
    } catch (error) {
      if (attempt === MAX_DB_WAIT_ATTEMPTS) {
        log(`⚠️  PostgreSQL is not responding after ${MAX_DB_WAIT_ATTEMPTS} attempts`, colors.red);
        log('Please ensure PostgreSQL is running:', colors.yellow);
        log('  pnpm dx:services', colors.cyan);
        process.exit(1);
      }
      await sleep(DB_CHECK_INTERVAL);
    }
  }
}

async function setupDatabase() {
  logSection('Setting Up Medusa Database');

  log('Running database setup (migrations + links)...', colors.blue);

  try {
    execCommand('pnpm exec medusa db:setup --no-interactive --execute-safe-links', {
      env: { ...process.env, PATH: process.env.PATH },
    });
    log('✓ Database setup completed', colors.green);
  } catch (error) {
    log('⚠️  Database setup failed', colors.red);
    throw error;
  }
}

async function createAdminUser(email, password) {
  logSection('Creating Admin User');

  log(`Checking if admin user exists (${email})...`, colors.yellow);

  try {
    // Try to create the user - Medusa will handle if it already exists
    const cmd = `pnpm exec medusa user -e "${email}" -p "${password}" --id admin`;
    execCommand(cmd, { ignoreError: true });
    log('✓ Admin user created or already exists', colors.green);
  } catch (error) {
    // Check if error is because user already exists
    if (error.message && error.message.includes('already exists')) {
      log('✓ Admin user already exists', colors.green);
    } else {
      log('⚠️  Failed to create admin user', colors.red);
      throw error;
    }
  }
}

async function runSeedData() {
  logSection('Seeding Database');

  const seedFile = path.join(BACKEND_DIR, 'src/scripts/seed.ts');

  if (!fs.existsSync(seedFile)) {
    log('ℹ️  No seed file found, skipping seed data', colors.yellow);
    log(`   Create ${seedFile} to add sample data`, colors.cyan);
    return;
  }

  try {
    log('Running seed script...', colors.blue);
    execCommand('pnpm db:seed');
    log('✓ Seed data loaded', colors.green);
  } catch (error) {
    log('⚠️  Seed data failed (this is optional)', colors.yellow);
    log(`   Error: ${error.message}`, colors.red);
  }
}

async function main() {
  console.log();
  log('╔════════════════════════════════════════════════════╗', colors.bright + colors.blue);
  log('║     Medusa B2C Boilerplate - DB Setup             ║', colors.bright + colors.blue);
  log('╚════════════════════════════════════════════════════╝', colors.bright + colors.blue);

  try {
    // Step 1: Check environment variables
    const envVars = await checkEnvironmentVariables();

    // Step 2: Wait for database
    await waitForDatabase(envVars.DATABASE_URL);

    // Step 3: Setup database (migrations + links)
    await setupDatabase();

    // Step 4: Create admin user
    await createAdminUser(envVars.ADMIN_EMAIL, envVars.ADMIN_PASSWORD);

    // Step 5: Run seed data (optional)
    await runSeedData();

    logSection('Setup Complete!');
    log('✓ Medusa database is ready', colors.green);
    log('\nYou can now start the development server:', colors.cyan);
    log('  pnpm dev', colors.bright + colors.cyan);
    log('\nAdmin credentials:', colors.yellow);
    log(`  Email: ${envVars.ADMIN_EMAIL}`, colors.yellow);
    log(`  Password: ${envVars.ADMIN_PASSWORD}`, colors.yellow);
    log(`  Admin URL: http://localhost:${envVars.PORT || '9000'}/app`, colors.yellow);
    console.log();
  } catch (error) {
    log(`\n⚠️  Setup failed: ${error.message}`, colors.red);
    process.exit(1);
  }
}

// Run main
main();
