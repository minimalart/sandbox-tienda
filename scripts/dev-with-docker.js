#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const path = require('path');

// Configuration
const COMPOSE_FILE = path.join(__dirname, '../infra/docker-compose.yml');
// Postgres viene por afuera del compose: nativo (DBngin) o contenedor manual
// (`b2c-db-prod-clone`, `odoo-local-db-1`, etc.). El servicio `db` del compose
// tiene `profiles: ['docker-db']` y se opta explicitamente con
// `docker compose --profile docker-db up -d db` cuando no hay una instancia
// disponible. Antes teniamos `db` en esta lista y el `up -d db redis typesense`
// pasaba por encima del profile-guard, chocando por nombre con cualquier
// contenedor `b2c-db*` que hubiera quedado o corriendo.
const SERVICES = ['redis', 'typesense'];
const HEALTH_CHECK_INTERVAL = 2000; // 2 seconds
const MAX_HEALTH_CHECK_ATTEMPTS = 30; // 60 seconds total

// State tracking
let turboProcess = null;
let isShuttingDown = false;
// Servicios de compose que ESTE proceso arrancó. La cleanup solo baja lo que
// levantó — cualquier otro servicio del compose (o del sistema) se preserva.
let startedServices = [];

// ANSI color codes for better terminal output
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
      ...options,
    });
  } catch (error) {
    if (!options.ignoreError) {
      throw error;
    }
    return null;
  }
}

async function checkDockerRunning() {
  try {
    execCommand('docker info', { silent: true });
    return true;
  } catch {
    return false;
  }
}

async function startDockerServices() {
  logSection('Starting Docker Infrastructure Services');

  const isDockerRunning = await checkDockerRunning();
  if (!isDockerRunning) {
    log('⚠️  Docker is not running. Please start Docker Desktop first.', colors.red);
    process.exit(1);
  }

  startedServices = [...SERVICES];
  log(`Starting services: ${startedServices.join(', ')}`, colors.blue);
  log(
    "Postgres: use a native service (DBngin) or start it manually with " +
      "`docker compose --profile docker-db up -d db`.",
    colors.cyan,
  );

  const cmd = `docker compose -f "${COMPOSE_FILE}" up -d ${startedServices.join(' ')}`;
  execCommand(cmd);

  log('✓ Docker services started', colors.green);
}

async function waitForHealthy() {
  if (startedServices.length === 0) return;
  logSection('Waiting for Services to be Healthy');

  for (const service of startedServices) {
    log(`Checking ${service}...`, colors.yellow);

    let attempts = 0;
    let isHealthy = false;

    while (attempts < MAX_HEALTH_CHECK_ATTEMPTS && !isHealthy) {
      try {
        const output = execCommand(
          `docker compose -f "${COMPOSE_FILE}" ps ${service} --format json`,
          { silent: true }
        );

        if (output) {
          const serviceInfo = JSON.parse(output);
          const health = serviceInfo.Health || 'unknown';

          if (health === 'healthy' || serviceInfo.State === 'running') {
            isHealthy = true;
            log(`✓ ${service} is healthy`, colors.green);
            break;
          }
        }
      } catch (error) {
        // Service not ready yet, continue waiting
      }

      attempts++;
      if (!isHealthy) {
        await sleep(HEALTH_CHECK_INTERVAL);
      }
    }

    if (!isHealthy) {
      log(
        `⚠️  ${service} failed health check after ${MAX_HEALTH_CHECK_ATTEMPTS} attempts`,
        colors.red
      );
      await cleanup();
      process.exit(1);
    }
  }

  log('✓ All services are healthy', colors.green);
}

async function startApplications() {
  logSection('Starting Applications');

  return new Promise((resolve, reject) => {
    // `--filter=@repo/storefront... --filter=@repo/backend...` limita a las dos
    // apps + sus workspace deps: turbo builda los plugins de workspace via
    // `^build` (turbo.json → dev depende de ^build) antes de arrancar `next dev`
    // / `medusa develop`, y NO corre `dev` en TODOS los plugins (que en Windows
    // pelean por `~/.config/medusa/config.json` con `configstore` y tiran EPERM
    // en cascada). `--parallel` está deprecado en turbo 2; `persistent: true` en
    // turbo.json ya deja las dos apps corriendo en paralelo.
    turboProcess = spawn(
      'pnpm',
      [
        'turbo',
        'run',
        'dev',
        '--filter=@repo/storefront...',
        '--filter=@repo/backend...',
      ],
      {
        stdio: 'inherit',
        shell: true, // Use shell on Windows to resolve pnpm.cmd
        cwd: path.join(__dirname, '..'),
      },
    );

    turboProcess.on('error', (error) => {
      log(`⚠️  Failed to start applications: ${error.message}`, colors.red);
      reject(error);
    });

    // Handle turbo process exit
    turboProcess.on('exit', (code, signal) => {
      if (!isShuttingDown && code !== 0) {
        log(
          `\n⚠️  Applications exited unexpectedly (code: ${code}, signal: ${signal})`,
          colors.red
        );
        cleanup().then(() => process.exit(code || 1));
      }
    });

    // Give it a moment to start
    setTimeout(() => {
      if (turboProcess && !turboProcess.killed) {
        log('✓ Applications started', colors.green);
        resolve();
      }
    }, 1000);
  });
}

async function stopDockerServices() {
  if (startedServices.length === 0) {
    log('No compose services were started by this run — nothing to stop.', colors.blue);
    return;
  }

  log(`Stopping compose services: ${startedServices.join(', ')}`, colors.yellow);

  try {
    // Solo paramos lo que este proceso arrancó. `down --remove-orphans` antes
    // acá tumbaba redis/typesense de otras sesiones y también servicios
    // externos referenciados en el compose file (como un `b2c-db-prod-clone`
    // que corre por afuera) — mala UX para quien usa multi-worktree o snapshots
    // de prod. `stop` preserva contenedores y volúmenes, listos para `start`.
    execCommand(
      `docker compose -f "${COMPOSE_FILE}" stop ${startedServices.join(' ')}`,
    );
    log('✓ Docker services stopped (containers and volumes preserved)', colors.green);
  } catch (error) {
    log(`⚠️  Error stopping Docker services: ${error.message}`, colors.red);
  }
}

async function cleanup() {
  logSection('Shutting Down');

  // Stop Turbo processes
  if (turboProcess && !turboProcess.killed) {
    log('Stopping applications...', colors.yellow);

    // Give the child process time to handle the signal it already received
    await sleep(3000);

    // Force kill if still running
    if (turboProcess && !turboProcess.killed) {
      try {
        turboProcess.kill('SIGKILL');
        await sleep(500);
      } catch (error) {
        // Process might already be dead
      }
    }
    log('✓ Applications stopped', colors.green);
  }

  // Stop Docker services
  await stopDockerServices();

  log('\n✓ Cleanup complete', colors.green);
}

async function main() {
  console.log();
  log('╔════════════════════════════════════════════════════╗', colors.bright + colors.blue);
  log('║  Medusa B2C Boilerplate — Dev Environment           ║', colors.bright + colors.blue);
  log('╚════════════════════════════════════════════════════╝', colors.bright + colors.blue);

  try {
    // Start Docker services
    await startDockerServices();

    // Wait for health checks
    await waitForHealthy();

    // Start applications
    await startApplications();

    logSection('Development Environment Ready');
    log('Press Ctrl+C to stop all services\n', colors.cyan);
  } catch (error) {
    log(`\n⚠️  Error during startup: ${error.message}`, colors.red);
    await cleanup();
    process.exit(1);
  }
}

// Setup signal handlers before starting any processes
function setupSignalHandlers() {
  const handleShutdown = (signal) => {
    if (isShuttingDown) {
      if (signal === 'SIGINT') {
        // Force exit on second CTRL+C
        log('\nForce exiting...', colors.red);
        // Force kill any remaining processes
        if (turboProcess && !turboProcess.killed) {
          turboProcess.kill('SIGKILL');
        }
        process.exit(1);
      }
      return;
    }

    if (signal === 'SIGINT') {
      console.log(); // New line after ^C
    }

    log(`\nReceived ${signal}, shutting down gracefully...`, colors.yellow);

    // Mark as shutting down immediately
    isShuttingDown = true;

    // Forward signal to child process first
    if (turboProcess && !turboProcess.killed) {
      try {
        turboProcess.kill(signal);
      } catch (error) {
        log(`⚠️  Error sending ${signal} to child: ${error.message}`, colors.red);
      }
    }

    // Run cleanup and ensure it completes
    cleanup()
      .then(() => {
        log('✓ Shutdown complete', colors.green);
        process.exit(0);
      })
      .catch((error) => {
        log(`\n⚠️  Error during cleanup: ${error.message}`, colors.red);
        process.exit(1);
      });
  };

  // Handle SIGINT (CTRL+C)
  process.on('SIGINT', () => handleShutdown('SIGINT'));

  // Handle SIGTERM
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}

// Setup handlers early
setupSignalHandlers();

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
  log(`\n⚠️  Uncaught error: ${error.message}`, colors.red);
  await cleanup();
  process.exit(1);
});

process.on('unhandledRejection', async (error) => {
  log(`\n⚠️  Unhandled rejection: ${error.message}`, colors.red);
  await cleanup();
  process.exit(1);
});

// Run main
main();
