import test from 'node:test';
import assert from 'node:assert/strict';
import { runCommand } from '../lib/cli-providers.mjs';

test('stopping a run cancels the local subprocess instead of leaving inference running', async () => {
  const controller = new AbortController();
  const result = runCommand({
    command: process.execPath,
    args: ['-e', 'process.stdin.resume(); setInterval(() => {}, 1000);'],
    env: {},
    signal: controller.signal,
    timeoutMs: 5000,
  });
  const timer = setTimeout(() => controller.abort(), 80);
  try {
    await assert.rejects(result, error => error.code === 'ANALYSIS_CANCELLED');
  } finally { clearTimeout(timer); }
});

test('excessive subprocess output is bounded and terminates the run', async () => {
  await assert.rejects(runCommand({
    command: process.execPath,
    args: ['-e', 'process.stdout.write("x".repeat(10000)); setInterval(() => {}, 1000);'],
    env: {},
    maxOutputBytes: 1000,
    timeoutMs: 5000,
  }), error => error.code === 'CLI_OUTPUT_LIMIT');
});
