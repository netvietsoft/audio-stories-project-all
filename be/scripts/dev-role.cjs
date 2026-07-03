#!/usr/bin/env node

const { spawn } = require('node:child_process');
const path = require('node:path');
const process = require('node:process');

const role = process.argv[2];
const projectRoot = path.resolve(__dirname, '..');
const yarnCommand = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
const validRoles = new Set(['api', 'worker', 'scheduler']);

if (!validRoles.has(role)) {
  console.error('[dev-role] Invalid role. Expected one of: api, worker, scheduler.');
  process.exit(1);
}

const env = {
  ...process.env,
  APP_ROLE: role,
};

const steps = role === 'api'
  ? [
      {
        label: 'Applying Prisma migrations (safe deploy)',
        args: ['prisma:migrate:deploy:safe'],
      },
      {
        label: 'Starting Nest dev runtime',
        args: ['start:dev:nest'],
      },
    ]
  : [
      {
        label: 'Starting Nest dev runtime',
        args: ['start:dev:nest'],
      },
    ];

let child = null;

function runStep(index) {
  const step = steps[index];
  if (!step) {
    process.exit(0);
  }

  console.log(`[dev-role] APP_ROLE=${role} :: ${step.label}`);
  child = spawn(yarnCommand, step.args, {
    cwd: projectRoot,
    env,
    stdio: 'inherit',
  });

  child.on('exit', (code, signal) => {
    child = null;

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    if (code !== 0) {
      process.exit(code ?? 1);
      return;
    }

    runStep(index + 1);
  });

  child.on('error', (error) => {
    console.error(`[dev-role] Failed to start ${step.args.join(' ')}:`, error);
    process.exit(1);
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill(signal);
      return;
    }

    process.exit(signal === 'SIGINT' ? 130 : 143);
  });
}

runStep(0);
