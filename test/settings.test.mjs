import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApplication } from '../server.mjs';

async function temporarySettings(t) {
  const parent = await mkdtemp(path.join(tmpdir(), 'idea-lab-settings-test-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  return path.join(parent, 'settings');
}

async function serve(t, directory, options = {}) {
  const server = createApplication({ apiKey: '', settingsDirectory: directory, providerAvailability: { codex: false, claude: false }, ...options });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const close = async () => { if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); };
  t.after(close);
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base, close,
    async request(route, method = 'GET', body, headers = {}) {
      return fetch(`${base}${route}`, { method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    },
  };
}

async function safeJson(response, ...secrets) {
  const text = await response.text();
  for (const secret of secrets) if (secret) assert.equal(text.includes(secret), false, 'HTTP response must not contain an API credential');
  return JSON.parse(text);
}

test('UI settings are lazy, private, sanitized and persist across server restarts', async (t) => {
  const directory = await temporarySettings(t);
  const app = await serve(t, directory);
  const initial = await app.request('/api/settings');
  assert.equal(initial.headers.get('cache-control'), 'no-store');
  assert.equal((await initial.json()).apiKeyConfigured, false);
  await assert.rejects(stat(directory), (error) => error.code === 'ENOENT');
  const key = 'sk-test-settings-only-123456789';
  const saved = await safeJson(await app.request('/api/settings', 'PUT', { provider: 'openai', apiKey: key, model: 'gpt-test-settings' }), key);
  assert.equal(saved.apiKeyConfigured, true);
  assert.equal(saved.apiKeySource, 'saved');
  assert.equal(saved.model, 'gpt-test-settings');
  assert.equal(Object.hasOwn(saved, 'apiKey'), false);
  assert.equal((await stat(directory)).mode & 0o777, 0o700);
  assert.equal((await stat(path.join(directory, 'settings.json'))).mode & 0o777, 0o600);
  assert.equal(JSON.parse(await readFile(path.join(directory, 'settings.json'), 'utf8')).apiKey, key);
  await app.close();
  const restarted = await serve(t, directory);
  const restored = await safeJson(await restarted.request('/api/settings'), key);
  assert.equal(restored.apiKeyConfigured, true);
  assert.equal(restored.model, 'gpt-test-settings');
  assert.equal((await safeJson(await restarted.request('/api/status'), key)).configured, true);
  const hidden = await restarted.request('/.data/settings.json');
  assert.equal(hidden.status, 404);
  await safeJson(hidden, key);
});

test('omitted or empty API keys retain the saved key; replacement and explicit clear are deliberate', async (t) => {
  const directory = await temporarySettings(t);
  const oldKey = 'sk-test-old-key-123456789';
  const newKey = 'sk-test-new-key-987654321';
  const environmentKey = 'sk-test-environment-only-12345';
  const calls = [];
  const app = await serve(t, directory, { apiKey: environmentKey, fetchImpl: async (url, options) => { calls.push({ url, options }); return new Response('{}', { status: 200 }); } });
  assert.equal((await safeJson(await app.request('/api/settings'), environmentKey)).apiKeySource, 'environment');
  await safeJson(await app.request('/api/settings', 'PUT', { apiKey: oldKey }), oldKey, environmentKey);
  await safeJson(await app.request('/api/settings', 'PUT', { model: 'gpt-replacement-test' }), oldKey);
  await safeJson(await app.request('/api/settings', 'PUT', { apiKey: '   ' }), oldKey);
  const testResponse = await app.request('/api/settings/test', 'POST', {});
  assert.equal(testResponse.status, 200);
  await safeJson(testResponse, oldKey, environmentKey);
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${oldKey}`);
  await safeJson(await app.request('/api/settings', 'PUT', { apiKey: newKey }), oldKey, newKey);
  await app.request('/api/settings/test', 'POST', {});
  assert.equal(calls[1].options.headers.Authorization, `Bearer ${newKey}`);
  await safeJson(await app.request('/api/settings', 'PUT', { clearApiKey: true }), newKey);
  assert.equal((await app.request('/api/settings/test', 'POST', {})).status, 503);
  assert.equal(calls.length, 2);
  await app.close();
  const restarted = await serve(t, directory, { apiKey: environmentKey });
  const cleared = await safeJson(await restarted.request('/api/settings'), oldKey, newKey, environmentKey);
  assert.equal(cleared.apiKeyConfigured, false);
  assert.equal(cleared.apiKeySource, 'none');
  assert.equal((await readFile(path.join(directory, 'settings.json'), 'utf8')).includes(newKey), false);
});

test('settings reject cross-origin requests, invalid providers/models, ambiguous changes and oversized JSON', async (t) => {
  const directory = await temporarySettings(t);
  const app = await serve(t, directory);
  for (const [route, method, body] of [['/api/settings', 'PUT', { apiKey: 'sk-not-saved-12345' }], ['/api/settings/test', 'POST', {}], ['/api/settings', 'GET', undefined]]) {
    const response = await app.request(route, method, body, { origin: 'https://untrusted.example' });
    assert.equal(response.status, 403);
  }
  const rebound = await new Promise((resolve, reject) => {
    const request = httpRequest(`${app.base}/api/settings`, { method: 'PUT', headers: { host: 'untrusted.example', 'content-type': 'application/json' } }, (response) => { response.resume(); response.on('end', () => resolve(response.statusCode)); });
    request.on('error', reject);
    request.end(JSON.stringify({ apiKey: 'sk-not-saved-12345' }));
  });
  assert.equal(rebound, 403);
  for (const body of [{ provider: 'other' }, { provider: null }, { model: '../invalid' }, { model: 'x'.repeat(121) }, { model: 'sk-test-mistaken-secret' }, { model: null }, { apiKey: null }, { apiKey: 'x'.repeat(513) }, { apiKey: 'sk-key-with\nnewline' }, { clearApiKey: 'yes' }, { apiKey: 'sk-test-ambiguous-key', clearApiKey: true }, { unexpected: 'field' }]) {
    const response = await app.request('/api/settings', 'PUT', body);
    assert.equal(response.status, 400);
    const text = await response.text();
    if (typeof body.apiKey === 'string' && body.apiKey.length > 8) assert.equal(text.includes(body.apiKey), false);
  }
  assert.equal((await app.request('/api/settings', 'PUT', { apiKey: 'x'.repeat(5000) })).status, 413);
  assert.equal((await app.request('/api/settings/test', 'POST', { provider: null })).status, 400);
  assert.equal((await app.request('/api/settings', 'POST', {})).status, 405);
  const response = await fetch(`${app.base}/api/settings`, { method: 'PUT', headers: { 'content-type': 'text/plain' }, body: '{}' });
  assert.equal(response.status, 415);
  await assert.rejects(stat(directory), (error) => error.code === 'ENOENT');
});

test('authentication tests use only the models endpoint and never expose provider failure bodies', async (t) => {
  const key = 'sk-test-no-inference-123456789';
  const calls = [];
  const directory = await temporarySettings(t);
  const app = await serve(t, directory, { fetchImpl: async (url, options) => { calls.push({ url, options }); return new Response(`private provider text ${key}`, { status: 401 }); } });
  await app.request('/api/settings', 'PUT', { apiKey: key });
  const failure = await app.request('/api/settings/test', 'POST', {});
  assert.equal(failure.status, 401);
  assert.equal((await safeJson(failure, key)).code, 'SETTINGS_AUTH_FAILED');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.openai.com/v1/models');
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.body, undefined);
});

test('subscription connection tests check native auth only and the saved preference is used immediately', async (t) => {
  const calls = [];
  const directory = await temporarySettings(t);
  const app = await serve(t, directory, { providerAvailability: { codex: true, claude: false }, cliRunner: async (invocation) => { calls.push(invocation); return { exitCode: 0, stdout: 'Logged in using ChatGPT', stderr: '' }; }, fetchImpl: () => { throw new Error('Unexpected API call'); } });
  await app.request('/api/settings', 'PUT', { provider: 'codex' });
  const response = await app.request('/api/settings/test', 'POST', {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).provider, 'codex');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args, ['login', 'status']);
});

test('the next analysis uses updated credentials and model without restarting the server', async (t) => {
  const problem = {
    jtbd: [{ id: 'j1', situation: 'During planning', motivation: 'Find a blocker', outcome: 'Act before the deadline', priority: 'high' }],
    requirements: [{ id: 'r1', title: 'Find blockers', why: 'Act earlier', metric: 'Preparation time', jobIds: ['j1'] }],
  };
  const market = {
    summary: { title: 'Planning test', thesis: 'Unproven', verdict: 'Test', nextStep: 'Interview users' }, competitors: [],
    counterIdeas: [{ id: 'c1', title: 'Low frequency', argument: 'Unknown frequency', severity: 'high', falsificationTest: 'Observe real planning' }],
    refinements: [{ id: 'p1', title: 'Small teams', audience: 'Small teams', problem: 'Blocked planning', differentiation: 'Proposed workflow', experiment: 'Observe teams', successCriterion: 'Useful result' }],
    evidence: [], limitations: ['Test fixture only'],
    iteration: { decision: 'test', rationale: 'Field evidence required', weakestAssumption: 'Frequency', changeSummary: 'Initial', selectedRefinementId: 'p1', newInformation: 'None', remainingRisks: ['Demand'] },
  };
  const calls = [];
  const directory = await temporarySettings(t);
  const app = await serve(t, directory, { fetchImpl: async (url, options) => {
    calls.push({ url, options });
    const second = calls.length % 2 === 0;
    const output = [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(second ? market : problem), annotations: [] }] }];
    if (second) output.unshift({ type: 'web_search_call', status: 'completed', action: { sources: [] } });
    return new Response(JSON.stringify({ status: 'completed', output }), { status: 200 });
  } });
  const firstKey = 'sk-test-dynamic-first-12345';
  const secondKey = 'sk-test-dynamic-second-98765';
  const input = { idea: 'A small tool to detect planning blockers before team meetings.' };
  await app.request('/api/settings', 'PUT', { provider: 'openai', apiKey: firstKey, model: 'gpt-dynamic-one' });
  assert.equal((await app.request('/api/analyze', 'POST', input)).status, 200);
  await app.request('/api/settings', 'PUT', { apiKey: secondKey, model: 'gpt-dynamic-two' });
  const response = await app.request('/api/analyze', 'POST', input);
  assert.equal(response.status, 200);
  await safeJson(response, firstKey, secondKey);
  assert.equal(calls.length, 4);
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${firstKey}`);
  assert.equal(calls[2].options.headers.Authorization, `Bearer ${secondKey}`);
  assert.equal(JSON.parse(calls[0].options.body).model, 'gpt-dynamic-one');
  assert.equal(JSON.parse(calls[2].options.body).model, 'gpt-dynamic-two');
});
