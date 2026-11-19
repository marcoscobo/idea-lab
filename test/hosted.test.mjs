import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApplication } from '../server.mjs';
import apiHandler from '../api/index.mjs';
import { HOSTED_COOKIE_NAME } from '../lib/hosted-settings.mjs';
import { problemSchema, marketSchema } from '../lib/analysis-schema.mjs';
import { createExample } from '../public/examples.mjs';

const SESSION_SECRET = 'test-session-secret-for-hosted-mode-only-123456789';
const OWNER_KEY = 'sk-test-owner-must-never-be-used';
const VISITOR_KEY = 'sk-test-private-visitor-one-123456789';
const HOST = 'idea-lab-test.vercel.app';
const ORIGIN = `https://${HOST}`;

async function serve(t, options = {}, customHandler) {
  const directory = await mkdtemp(path.join(tmpdir(), 'idea-lab-hosted-test-'));
  const diskPath = path.join(directory, 'must-not-exist');
  const server = customHandler ? http.createServer(customHandler) : createApplication({ hosted: true, sessionSecret: SESSION_SECRET, apiKey: OWNER_KEY, settingsDirectory: diskPath, ...options });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  });
  return {
    diskPath,
    request(route, { method = 'GET', body, cookie, origin = ORIGIN, headers = {} } = {}) {
      return new Promise((resolve, reject) => {
        const request = http.request({ hostname: '127.0.0.1', port: server.address().port, path: route, method, headers: { host: HOST, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(origin === undefined || origin === null ? {} : { origin }), ...(cookie ? { cookie } : {}), ...headers } }, (response) => {
          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            resolve({ status: response.statusCode, headers: response.headers, text, json: () => JSON.parse(text) });
          });
        });
        request.on('error', reject);
        request.end(body === undefined ? undefined : JSON.stringify(body));
      });
    },
  };
}

function cookieFrom(response) {
  const value = response.headers['set-cookie']?.[0];
  assert.equal(typeof value, 'string');
  return value.split(';')[0];
}

test('hosted settings ignore owner credentials and persist visitor keys only in authenticated secure cookies', async (t) => {
  const app = await serve(t);
  const initial = await app.request('/api/settings', { origin: null });
  assert.equal(initial.status, 200);
  assert.equal(initial.headers['cache-control'], 'no-store');
  assert.equal(initial.json().apiKeyConfigured, false);
  assert.equal(initial.json().runtime, 'hosted');
  assert.equal(initial.json().storage, 'encrypted_cookie');
  assert.equal(initial.json().needsSessionSecret, false);
  assert.equal(initial.json().providers.find((item) => item.id === 'codex').available, false);
  const saved = await app.request('/api/settings', { method: 'PUT', body: { apiKey: VISITOR_KEY, model: 'gpt-hosted-test' } });
  assert.equal(saved.status, 200);
  assert.equal(saved.json().apiKeyConfigured, true);
  assert.equal(saved.text.includes(VISITOR_KEY), false);
  assert.equal(saved.text.includes(OWNER_KEY), false);
  const header = saved.headers['set-cookie'][0];
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', 'Max-Age=86400']) assert.ok(header.includes(flag));
  assert.equal(header.includes(VISITOR_KEY), false);
  assert.ok(header.length < 4096);
  const cookie = cookieFrom(saved);
  assert.ok(cookie.startsWith(`${HOSTED_COOKIE_NAME}=`));
  const restored = await app.request('/api/settings', { cookie });
  assert.equal(restored.json().apiKeyConfigured, true);
  assert.equal(restored.json().model, 'gpt-hosted-test');
  assert.equal((await app.request('/api/settings')).json().apiKeyConfigured, false);
  await assert.rejects(stat(app.diskPath), (error) => error.code === 'ENOENT');
});

test('cookies isolate visitors, work across instances with a shared secret, and cannot use the owner key', async (t) => {
  const authorizations = [];
  const fetchImpl = async (url, options) => { authorizations.push({ url, header: options.headers.Authorization }); return new Response('{}', { status: 200 }); };
  const first = await serve(t, { fetchImpl });
  const second = await serve(t, { fetchImpl });
  const visitorOne = cookieFrom(await first.request('/api/settings', { method: 'PUT', body: { apiKey: VISITOR_KEY } }));
  const otherKey = 'sk-test-private-visitor-two-987654321';
  const visitorTwo = cookieFrom(await second.request('/api/settings', { method: 'PUT', body: { apiKey: otherKey } }));
  assert.equal((await second.request('/api/settings/test', { method: 'POST', body: {}, cookie: visitorOne })).status, 200);
  assert.equal((await first.request('/api/settings/test', { method: 'POST', body: {}, cookie: visitorTwo })).status, 200);
  assert.equal((await first.request('/api/settings/test', { method: 'POST', body: {} })).status, 503);
  assert.deepEqual(authorizations.map((item) => item.header), [`Bearer ${VISITOR_KEY}`, `Bearer ${otherKey}`]);
  assert.ok(authorizations.every((item) => item.url === 'https://api.openai.com/v1/models'));
});

test('concurrent hosted analyses use each visitor key without a cross-visitor mutex or owner fallback', async (t) => {
  const fixture = createExample('office-lunch').rounds[2];
  const pick = (schema) => Object.fromEntries(Object.keys(schema.properties).map((key) => [key, fixture[key]]));
  const credentials = [];
  const app = await serve(t, { fetchImpl: async (_url, options) => {
    credentials.push(options.headers.Authorization);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const market = JSON.parse(options.body).text.format.name === 'market_analysis';
    const output = [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(pick(market ? marketSchema : problemSchema)), annotations: [] }] }];
    if (market) output.unshift({ type: 'web_search_call', status: 'completed', action: { sources: fixture.sources } });
    return new Response(JSON.stringify({ status: 'completed', output }), { status: 200 });
  } });
  const secondKey = 'sk-test-hosted-second-analysis-98765';
  const firstCookie = cookieFrom(await app.request('/api/settings', { method: 'PUT', body: { apiKey: VISITOR_KEY } }));
  const secondCookie = cookieFrom(await app.request('/api/settings', { method: 'PUT', body: { apiKey: secondKey } }));
  const input = { idea: 'Help a small team coordinate a fixed lunch order during one daily delivery window.' };
  assert.equal((await app.request('/api/analyze', { method: 'POST', body: input })).status, 503);
  assert.equal(credentials.length, 0);
  const results = await Promise.all([firstCookie, secondCookie].map((cookie) => app.request('/api/analyze', { method: 'POST', body: input, cookie })));
  assert.deepEqual(results.map((result) => result.status), [200, 200]);
  assert.equal(credentials.filter((value) => value === `Bearer ${VISITOR_KEY}`).length, 2);
  assert.equal(credentials.filter((value) => value === `Bearer ${secondKey}`).length, 2);
  for (const result of results) for (const key of [VISITOR_KEY, secondKey, OWNER_KEY]) assert.equal(result.text.includes(key), false);
});

test('tampered, expired, duplicated, oversized, or differently encrypted cookies never restore credentials', async (t) => {
  let current = 1_800_000_000_000;
  const app = await serve(t, { now: () => current });
  const cookie = cookieFrom(await app.request('/api/settings', { method: 'PUT', body: { apiKey: VISITOR_KEY } }));
  const split = cookie.indexOf('=') + 1;
  const value = cookie.slice(split);
  const tampered = `${cookie.slice(0, split)}${value.slice(0, 30)}${value[30] === 'A' ? 'B' : 'A'}${value.slice(31)}`;
  for (const invalid of [tampered, `${cookie}; ${cookie}`, `${HOSTED_COOKIE_NAME}=${'x'.repeat(3001)}`]) {
    assert.equal((await app.request('/api/settings', { cookie: invalid })).json().apiKeyConfigured, false);
  }
  const otherSecret = await serve(t, { sessionSecret: 'different-test-session-secret-123456789', now: () => current });
  assert.equal((await otherSecret.request('/api/settings', { cookie })).json().apiKeyConfigured, false);
  current += 24 * 60 * 60 * 1000;
  assert.equal((await app.request('/api/settings', { cookie })).json().apiKeyConfigured, false);
});

test('blank keys retain a visitor key and explicit removal clears it without restoring an owner key', async (t) => {
  const app = await serve(t);
  let cookie = cookieFrom(await app.request('/api/settings', { method: 'PUT', body: { apiKey: VISITOR_KEY } }));
  const retain = await app.request('/api/settings', { method: 'PUT', body: { apiKey: '', model: 'gpt-other-test' }, cookie });
  assert.equal(retain.json().apiKeyConfigured, true);
  cookie = cookieFrom(retain);
  const clear = await app.request('/api/settings', { method: 'PUT', body: { clearApiKey: true }, cookie });
  assert.equal(clear.json().apiKeyConfigured, false);
  cookie = cookieFrom(clear);
  assert.equal((await app.request('/api/status', { cookie })).json().configured, false);
  assert.equal((await app.request('/api/settings', { cookie })).json().apiKeySource, 'none');
});

test('hosted writes require same-origin browser metadata and subscription CLIs stay disabled', async (t) => {
  let cliCalls = 0;
  const app = await serve(t, { providerAvailability: { codex: true, claude: true }, cliRunner: () => { cliCalls++; throw new Error('CLI must never run online'); } });
  for (const origin of [null, 'https://foreign.example', 'null']) {
    assert.equal((await app.request('/api/settings', { method: 'PUT', origin, body: { apiKey: VISITOR_KEY } })).status, 403);
  }
  assert.equal((await app.request('/api/settings', { method: 'PUT', body: { apiKey: VISITOR_KEY }, headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
  for (const provider of ['codex', 'claude']) {
    for (const [route, body] of [['/api/settings', { provider }], ['/api/settings/test', { provider }], ['/api/analyze', { provider, idea: 'A proposed tool for planning team meetings with fewer blockers.' }]]) {
      const response = await app.request(route, { method: route === '/api/settings' ? 'PUT' : 'POST', body });
      assert.equal(response.status, 403);
      assert.equal(response.json().code, 'HOSTED_PROVIDER_UNSUPPORTED');
    }
  }
  assert.equal(cliCalls, 0);
});

test('missing session secrets keep examples/status usable and never enable insecure key persistence', async (t) => {
  for (const sessionSecret of ['', 'too-short']) {
    const app = await serve(t, { sessionSecret, fetchImpl: () => { throw new Error('Owner API must not be called'); } });
    assert.equal((await app.request('/')).status, 200);
    const status = await app.request('/api/status', { origin: null });
    assert.equal(status.json().configured, false);
    assert.equal(status.json().needsSessionSecret, true);
    const save = await app.request('/api/settings', { method: 'PUT', body: { apiKey: VISITOR_KEY } });
    assert.equal(save.status, 503);
    assert.equal(save.json().code, 'HOSTED_SESSION_UNAVAILABLE');
    assert.equal(save.text.includes(VISITOR_KEY), false);
    assert.equal(save.headers['set-cookie'], undefined);
    assert.equal((await app.request('/api/settings/test', { method: 'POST', body: {} })).status, 503);
    await assert.rejects(stat(app.diskPath), (error) => error.code === 'ENOENT');
  }
});

test('Vercel entry supports only known rewritten API routes and leaves normal API paths intact', async (t) => {
  const app = await serve(t, {}, apiHandler);
  assert.equal((await app.request('/api/index?route=status')).status, 200);
  assert.equal((await app.request('/api/status')).status, 200);
  assert.equal((await app.request('/api/index?route=settings')).status, 200);
  assert.equal((await app.request('/api/index?route=../server.mjs')).status, 404);
  assert.equal((await app.request('/api/index?route=status&route=analyze')).status, 404);
});

test('pre-parsed serverless JSON and malformed body getters retain validation boundaries', async (t) => {
  const application = createApplication({ hosted: true, sessionSecret: SESSION_SECRET });
  const handler = application.listeners('request')[0];
  const app = await serve(t, {}, (req, res) => {
    if (req.url === '/malformed') {
      req.url = '/api/settings';
      Object.defineProperty(req, 'body', { get() { throw new Error('private parser details'); } });
    } else {
      req.body = req.url === '/oversized' ? { apiKey: 'x'.repeat(5000) } : { apiKey: VISITOR_KEY };
      req.url = '/api/settings';
    }
    return handler(req, res);
  });
  const prepared = await app.request('/prepared', { method: 'PUT', body: {} });
  assert.equal(prepared.status, 200);
  assert.equal(prepared.json().apiKeyConfigured, true);
  assert.equal((await app.request('/oversized', { method: 'PUT', body: {} })).status, 413);
  const invalid = await app.request('/malformed', { method: 'PUT', body: {} });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.text.includes('private parser details'), false);
});
