import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerCartValidation } from '../../../../packages/plugins/plugin-runtime/src/cart-validation';
import { createHook, createWorkflow, WorkflowResponse, StepResponse } from '@medusajs/framework/workflows-sdk';

test('real Medusa workflow accepts both validators, runs once each and compensates on later failure', async () => {
  const events: string[] = [];
  const workflow = createWorkflow('checkout-composed-validation-test', function(input: { fail: boolean }) {
    const validate = createHook('validate', input);
    return new WorkflowResponse(input, { hooks: [validate] });
  });
  registerCartValidation(workflow, 'gift-cards', async () => { events.push('gift'); }, undefined, data => new StepResponse(undefined, data));
  registerCartValidation(workflow, 'checkout', async () => { events.push('checkout'); return 'cart'; }, async data => { assert.equal(data, 'cart'); events.push('release'); }, data => new StepResponse(undefined, data));
  registerCartValidation(workflow, 'later', async input => { if(input.fail) throw new Error('invalid'); }, undefined, data => new StepResponse(undefined, data));
  await workflow().run({ input: { fail: false } });
  assert.deepEqual(events, ['gift', 'checkout']);
  events.length = 0;
  await assert.rejects(workflow().run({ input: { fail: true } }), (error: any) => error.message === 'invalid');
  assert.deepEqual(events, ['gift', 'checkout', 'release']);
  assert.throws(() => registerCartValidation(workflow, 'checkout', async()=>{}, undefined, data => data), /Duplicate/);
});

test('boot registers gift card, checkout and catalog hooks together', () => {
  // Production loads plugins as CommonJS in one host container. Run the actual
  // source hooks through ts-node with that same host dependency resolution.
  const script = `const Module = require('module');
    const path = require('path');
    const host = new Module(path.resolve('package.json'));
    host.paths = Module._nodeModulePaths(process.cwd());
    const original = Module._resolveFilename;
    Module._resolveFilename = function(request, parent, ...args) {
      if (request.startsWith('@medusajs/')) {
        try { return original.call(this, request, host, ...args); }
        catch (error) { if(error.code !== 'MODULE_NOT_FOUND') throw error; }
      }
      return original.call(this, request, parent, ...args);
    };
    require('../../packages/plugins/plugin-gift-cards/src/workflows/hooks/gift-card-cart-validation.ts');
    require('./src/workflows/hooks/site-checkout-validation.ts');
    require('./src/workflows/hooks/catalog-cart-validation.ts');
    console.log('both validators registered');`;
  const result = spawnSync(process.execPath, ['-r', 'ts-node/register/transpile-only', '-e', script], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 120000,
    env: { ...process.env, TS_NODE_COMPILER_OPTIONS: JSON.stringify({ module: 'CommonJS', moduleResolution: 'node' }) },
  });
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.match(result.stdout, /both validators registered/);
});
