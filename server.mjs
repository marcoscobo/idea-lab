import http from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { problemSchema, marketSchema, validateSchema, validateRelations } from './lib/analysis-schema.mjs';
import { problemInstructions, marketInstructions } from './lib/prompts.mjs';
import { AppError } from './lib/errors.mjs';
import { cliResponse, ensureSubscriptionLogin, providerNames, providerStatus, runCommand, validateProvider } from './lib/cli-providers.mjs';
import { createSettingsStore, sanitizedSettings } from './lib/settings-store.mjs';
import { createHostedSettings, hostedProviderStatus, requireHostedProvider } from './lib/hosted-settings.mjs';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.join(projectRoot, 'public');
const DEFAULT_MODEL = 'gpt-6.2-astra';
const MAX_BODY = 64_000;
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

export function validateInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError(400, 'INVALID_INPUT', 'The idea must be a valid object.');
  const limits = { idea: [20, 8000], audience: [0, 600], market: [0, 300], goal: [0, 1200] };
  const input = {};
  for (const [key, [min, max]] of Object.entries(limits)) {
    const value = body[key] ?? '';
    if (typeof value !== 'string' || value.trim().length < min || value.length > max) {
      throw new AppError(400, 'INVALID_INPUT', key === 'idea' ? `Describe your idea in ${min}–${max} characters.` : `The ${key} field must be text of at most ${max} characters.`);
    }
    input[key] = value.trim();
  }
  if (body.context !== undefined) {
    if (typeof body.context !== 'string' || body.context.length > 8000) {
      throw new AppError(400, 'INVALID_INPUT', 'Iteration context must be text of at most 8000 characters.');
    }
    if (body.context.trim()) input.context = body.context.trim();
  }
  return input;
}

async function readJson(req, limit = MAX_BODY) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw new AppError(415, 'JSON_REQUIRED', 'Send the request as JSON.');
  // Serverless adapters may have parsed JSON already. Validate the same size
  // boundary before using it rather than waiting on an already-consumed stream.
  let preparedBody;
  try { preparedBody = req.body; }
  catch { throw new AppError(400, 'INVALID_JSON', 'The JSON request is invalid.'); }
  if (preparedBody !== undefined) {
    let text;
    try { text = Buffer.isBuffer(preparedBody) ? preparedBody.toString('utf8') : typeof preparedBody === 'string' ? preparedBody : JSON.stringify(preparedBody); }
    catch { throw new AppError(400, 'INVALID_JSON', 'The JSON request is invalid.'); }
    if (typeof text !== 'string') throw new AppError(400, 'INVALID_JSON', 'The JSON request is invalid.');
    if (Buffer.byteLength(text, 'utf8') > limit) throw new AppError(413, 'BODY_TOO_LARGE', 'The request is too large.');
    try { return JSON.parse(text); }
    catch { throw new AppError(400, 'INVALID_JSON', 'The JSON request is invalid.'); }
  }
  return new Promise((resolve, reject) => {
    let size = 0;
    let settled = false;
    const chunks = [];
    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > limit) {
        settled = true;
        chunks.length = 0;
        reject(new AppError(413, 'BODY_TOO_LARGE', 'The request is too large.'));
      } else chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new AppError(400, 'INVALID_JSON', 'The JSON request is invalid.')); }
    });
    req.on('error', () => {
      if (settled) return;
      settled = true;
      reject(new AppError(400, 'INVALID_JSON', 'The request data could not be received.'));
    });
  });
}

function requireSameOrigin(req, hosted = false) {
  let localHost = false;
  try { localHost = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(`http://${req.headers.host}`).hostname); } catch { /* Reject malformed hosts. */ }
  if (!hosted && !localHost) throw new AppError(403, 'ORIGIN_REJECTED', 'Open this local application using localhost or its loopback address.');
  const origin = req.headers.origin;
  const write = !['GET', 'HEAD'].includes(req.method);
  let sameOrigin = !origin && (!hosted || !write);
  try {
    if (origin) {
      const parsed = new URL(origin);
      sameOrigin = ['http:', 'https:'].includes(parsed.protocol) && parsed.host === req.headers.host;
    }
  } catch { /* Invalid origins are rejected below. */ }
  if (req.headers['sec-fetch-site'] === 'cross-site' || !sameOrigin) throw new AppError(403, 'ORIGIN_REJECTED', 'Send this request from the application itself.');
}

async function testApiAuthentication(apiKey, fetchImpl, signal) {
  if (!apiKey) throw new AppError(503, 'AI_NOT_CONFIGURED', 'Add an API key in Settings before testing the API connection.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  const timeout = setTimeout(abort, 15000);
  try {
    const response = await fetchImpl('https://api.openai.com/v1/models', { method: 'GET', headers: { Authorization: `Bearer ${apiKey}` }, signal: controller.signal });
    // Status is enough for an authentication check. Do not expose provider text
    // or run inference to test a user-supplied credential.
    await response.body?.cancel().catch(() => {});
    if (response.status === 401 || response.status === 403) throw new AppError(401, 'SETTINGS_AUTH_FAILED', 'The API key was not accepted. Check its validity and permissions.');
    if (response.status === 429) throw new AppError(429, 'PROVIDER_LIMIT', 'The API provider temporarily limited the authentication check. Try again later.');
    if (!response.ok) throw new AppError(502, 'SETTINGS_TEST_FAILED', 'The API authentication check could not be completed. Try again later.');
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (controller.signal.aborted) throw new AppError(504, 'SETTINGS_TEST_TIMEOUT', 'The connection test timed out or was cancelled.');
    throw new AppError(502, 'SETTINGS_TEST_FAILED', 'Could not connect to the API provider. Check your connection and try again.');
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
}

function safeUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; }
  catch { return ''; }
}

function urlKey(value) {
  const safe = safeUrl(value);
  if (!safe) return '';
  const url = new URL(safe);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) if (key.startsWith('utm_')) url.searchParams.delete(key);
  return url.href.replace(/\/$/, '');
}

function nativeSources(response) {
  const sources = new Map();
  const add = (source) => {
    const url = safeUrl(source.url);
    if (url) sources.set(urlKey(url), { url, title: source.title || new URL(url).hostname });
  };
  for (const item of response.output || []) {
    if (item.type === 'web_search_call') {
      for (const source of item.action?.sources || []) add(source);
      if (item.action?.url) add({ url: item.action.url });
    }
    if (item.type === 'message') for (const part of item.content || []) {
      for (const annotation of part.annotations || []) if (annotation.type === 'url_citation') add(annotation);
    }
  }
  return sources;
}

function parseResponse(response, schema) {
  if (response.status !== 'completed') throw new AppError(502, 'INCOMPLETE_ANALYSIS', 'The research did not complete. Try again with a more focused idea.');
  const parts = (response.output || []).filter((item) => item.type === 'message').flatMap((item) => item.content || []);
  if (parts.some((part) => part.type === 'refusal')) throw new AppError(422, 'ANALYSIS_REFUSED', 'The provider could not analyze this request. Rephrase the idea.');
  const outputText = parts.filter((part) => part.type === 'output_text').map((part) => part.text).join('');
  try { return validateSchema(JSON.parse(outputText), schema); }
  catch { throw new AppError(502, 'INVALID_ANALYSIS', 'The provider returned an incomplete analysis or invalid format. Please try again.'); }
}

async function modelResponse({ apiKey, model, fetchImpl, timeoutMs, signal, schema, instructions, input, research }) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) controller.abort();
  const timeout = setTimeout(abort, timeoutMs);
  try {
    const payload = {
      model, store: false, instructions, input,
      max_output_tokens: research ? 16000 : 8000,
      text: { format: { type: 'json_schema', name: research ? 'market_analysis' : 'problem_analysis', strict: true, schema } },
    };
    if (research) {
      payload.tools = [{ type: 'web_search', search_context_size: 'high', user_location: { type: 'approximate' } }];
      payload.tool_choice = 'required';
      payload.include = ['web_search_call.action.sources'];
      payload.max_tool_calls = 8;
    }
    const response = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: controller.signal,
    });
    if (!response.ok) {
      // Never expose provider bodies: they may repeat private input or credentials.
      if (response.status === 401 || response.status === 403) throw new AppError(502, 'PROVIDER_AUTH', 'The API key is invalid or does not have access to the configured model.');
      if (response.status === 429) throw new AppError(429, 'PROVIDER_LIMIT', 'The API provider has reached its limit or has no available balance. Check your account and try again.');
      throw new AppError(502, 'PROVIDER_ERROR', `The API provider could not complete the request (${response.status}). Check the configured model and try again.`);
    }
    const body = await response.json();
    return { analysis: parseResponse(body, schema), response: body };
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (controller.signal.aborted) throw new AppError(signal.aborted ? 499 : 504, signal.aborted ? 'ANALYSIS_CANCELLED' : 'ANALYSIS_TIMEOUT', signal.aborted ? 'Analysis cancelled.' : 'The research took too long. Try again with a more focused idea.');
    throw new AppError(502, 'PROVIDER_UNAVAILABLE', 'Could not connect to the API provider. Check your connection and try again.');
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
}

export async function analyzeIdea(input, { apiKey = '', provider = 'openai', model = DEFAULT_MODEL, fetchImpl = fetch, cliRunner = runCommand, cliCommands = {}, cliModels = {}, timeoutMs = 240000, signal = new AbortController().signal } = {}) {
  validateProvider(provider);
  const today = new Date().toISOString().slice(0, 10);
  const isApi = provider === 'openai';
  if (isApi && !apiKey.trim()) throw new AppError(503, 'AI_NOT_CONFIGURED', 'Add an API key in Settings, or choose a signed-in subscription CLI.');
  const common = isApi ? { apiKey, model, fetchImpl, timeoutMs, signal } : { provider, command: cliCommands[provider] || provider, model: cliModels[provider] || '', runner: cliRunner, timeoutMs, signal };
  if (!isApi) await ensureSubscriptionLogin(provider, { runner: cliRunner, command: common.command, signal });
  const phase = isApi ? modelResponse : cliResponse;
  const first = await phase({ ...common, schema: problemSchema, instructions: problemInstructions, input: JSON.stringify({ idea: input }), research: false });
  const second = await phase({ ...common, schema: marketSchema, instructions: marketInstructions(today), input: JSON.stringify({ idea: input, problem: first.analysis }), research: true });
  const market = second.analysis;
  try { validateRelations(first.analysis, market); }
  catch { throw new AppError(502, 'INVALID_ANALYSIS', 'The analysis contains incomplete references or an invalid selected refinement. Please try again.'); }
  const provenance = isApi ? 'native_web_search' : 'provider_reported';
  const sources = isApi ? nativeSources(second.response) : new Map();
  if (isApi) {
    const didSearch = (second.response.output || []).some((item) => item.type === 'web_search_call' && item.status === 'completed');
    if (!didSearch) throw new AppError(502, 'RESEARCH_MISSING', 'The API provider did not complete the required web search. This result was not saved as research.');
  } else {
    for (const item of [...market.competitors, ...market.evidence]) {
      const url = safeUrl(item.sourceUrl);
      if (url) sources.set(urlKey(url), { url, title: item.sourceTitle || new URL(url).hostname });
    }
    market.limitations.push('Sources in this result were reported by the subscription CLI. This server does not independently corroborate the CLI search transcript or verify that each page supports each claim. Review the linked pages before treating a claim as established.');
  }
  let unsourced = 0;
  for (const item of [...market.competitors, ...market.evidence]) {
    const source = sources.get(urlKey(item.sourceUrl));
    if (source) {
      item.sourceUrl = source.url;
      item.sourceProvenance = provenance;
      // Keep the supplied descriptive title when the native source has only a hostname.
      item.sourceTitle = source.title === new URL(source.url).hostname && item.sourceTitle ? item.sourceTitle : source.title;
      if (!isApi && 'status' in item) item.note = `${item.note} Source reported by the CLI; not independently corroborated by this server.`.trim();
    } else {
      if (item.sourceUrl || item.status === 'supported' || item.status === 'contradicted') unsourced++;
      item.sourceUrl = '';
      item.sourceTitle = '';
      item.sourceProvenance = 'none';
      if ('status' in item) {
        item.status = 'hypothesis';
        item.note = `${item.note} No corroborated source; this claim requires verification.`.trim();
      } else item.gap = `${item.gap} No corroborated source: this alternative requires manual verification.`.trim();
    }
  }
  if (unsourced) market.limitations.push(isApi ? 'Some references did not match sources returned by web search and were removed. Those claims or alternatives remain unverified.' : 'Some references were missing or were not valid web URLs and were removed. Those claims or alternatives remain unverified.');
  if (!sources.size) {
    market.limitations.push('No citable sources were returned. This analysis does not establish any market facts.');
    if (['continue', 'pivot'].includes(market.iteration.decision)) {
      market.iteration.decision = 'test';
      market.iteration.rationale = `${market.iteration.rationale} Automatic research cannot continue without citable sources; verify the research and gather primary evidence first.`.trim();
    }
  }
  market.limitations.push('Public sources can inform hypotheses, but do not prove willingness to pay, customer demand, or the absence of competition. Validate the proposed mechanism with customers and real experiments.');
  return { id: randomUUID(), createdAt: new Date().toISOString(), mode: 'live', provider: { id: provider, name: providerNames[provider], model: isApi ? model : cliModels[provider] || 'CLI default', provenance }, input, ...first.analysis, ...market, sources: [...sources.values()].map((source) => ({ ...source, provenance })) };
}

export function createApplication(options = {}) {
  const hosted = options.hosted === true;
  const { apiKey = hosted ? '' : process.env.OPENAI_API_KEY || '', model = process.env.OPENAI_MODEL || DEFAULT_MODEL, sessionSecret = process.env.IDEA_LAB_SESSION_SECRET || '', now = Date.now, fetchImpl = fetch, cliRunner = runCommand, cliCommands = { codex: process.env.CODEX_BIN || 'codex', claude: process.env.CLAUDE_BIN || 'claude' }, cliModels = { codex: process.env.CODEX_MODEL || '', claude: process.env.CLAUDE_MODEL || '' }, providerAvailability, timeoutMs = hosted ? 130000 : 240000 } = options;
  // Explicit credential injection is useful for embeddings/tests and defaults to
  // session-only settings. Production uses .data; callers can select an isolated
  // persistent directory or opt out explicitly with settingsDirectory: null.
  const settingsDirectory = Object.hasOwn(options, 'settingsDirectory') ? options.settingsDirectory : Object.hasOwn(options, 'apiKey') ? null : process.env.IDEA_LAB_DATA_DIR || path.join(projectRoot, '.data');
  const localSettingsStore = hosted ? null : createSettingsStore({ directory: settingsDirectory, environmentApiKey: apiKey, defaultModel: model });
  const providersFor = async (settings) => hosted ? hostedProviderStatus(settings.apiKeyConfigured) : providerStatus({ apiKey: settings.apiKey, commands: cliCommands, availability: providerAvailability });
  const runtime = hosted ? { runtime: 'hosted', storage: 'encrypted_cookie' } : { runtime: 'local', storage: 'local' };
  const publicSettings = async (settings) => ({ ...sanitizedSettings(settings, await providersFor(settings)), ...runtime, ...(hosted ? { needsSessionSecret: settings.needsSessionSecret } : {}) });
  const requireHostedSession = (settings) => {
    if (hosted && settings.needsSessionSecret) throw new AppError(503, 'HOSTED_SESSION_UNAVAILABLE', 'Online connection setup is not ready yet. The deployment owner must configure IDEA_LAB_SESSION_SECRET. No shared API key is available.');
  };
  let active = false;
  const server = http.createServer(async (req, res) => {
    const settingsStore = hosted ? createHostedSettings({ req, res, sessionSecret, defaultModel: model, now }) : localSettingsStore;
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    const send = (status, payload) => {
      if (res.destroyed || res.writableEnded) return;
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(payload));
    };
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      if (url.pathname === '/api/status' && req.method === 'GET') {
        const settings = await settingsStore.get();
        return send(200, { configured: settings.apiKeyConfigured, model: settings.model, providers: await providersFor(settings), ...runtime, ...(hosted ? { needsSessionSecret: settings.needsSessionSecret } : {}) });
      }
      if (url.pathname === '/api/settings' && req.method === 'GET') {
        requireSameOrigin(req, hosted);
        return send(200, await publicSettings(await settingsStore.get()));
      }
      if (url.pathname === '/api/settings' && req.method === 'PUT') {
        requireSameOrigin(req, hosted);
        const settings = await settingsStore.update(await readJson(req, 4096));
        return send(200, await publicSettings(settings));
      }
      if (url.pathname === '/api/settings/test' && req.method === 'POST') {
        requireSameOrigin(req, hosted);
        const body = await readJson(req, 1024);
        if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => key !== 'provider')) throw new AppError(400, 'INVALID_SETTINGS', 'Save settings first, then test the selected provider.');
        const settings = await settingsStore.get();
        const provider = validateProvider(Object.hasOwn(body, 'provider') ? body.provider : settings.provider);
        if (hosted) requireHostedProvider(provider);
        requireHostedSession(settings);
        const controller = new AbortController();
        res.on('close', () => { if (!res.writableEnded) controller.abort(); });
        if (provider === 'openai') await testApiAuthentication(settings.apiKey, fetchImpl, controller.signal);
        else {
          const providers = await providerStatus({ apiKey: settings.apiKey, commands: cliCommands, availability: providerAvailability });
          if (!providers.find((item) => item.id === provider)?.available) throw new AppError(503, 'CLI_NOT_INSTALLED', 'Install the selected official CLI and sign in with your subscription first.');
          await ensureSubscriptionLogin(provider, { runner: cliRunner, command: cliCommands[provider] || provider, signal: controller.signal });
        }
        return send(200, { ok: true, provider, message: provider === 'openai' ? 'API key accepted. No model request was made; model access and available usage were not tested.' : 'Subscription sign-in detected. No model request was made; model access and remaining quota were not tested.' });
      }
      if (url.pathname === '/api/analyze' && req.method === 'POST') {
        requireSameOrigin(req, hosted);
        const body = await readJson(req);
        const input = validateInput(body);
        const settings = await settingsStore.get();
        const provider = validateProvider(Object.hasOwn(body, 'provider') ? body.provider : settings.provider);
        if (hosted) requireHostedProvider(provider);
        requireHostedSession(settings);
        if (provider === 'openai' && !settings.apiKeyConfigured) throw new AppError(503, 'AI_NOT_CONFIGURED', 'Add an API key in Settings, or choose a signed-in subscription CLI.');
        if (provider !== 'openai') {
          const providers = await providerStatus({ apiKey: settings.apiKey, commands: cliCommands, availability: providerAvailability });
          if (!providers.find((item) => item.id === provider)?.available) throw new AppError(503, 'CLI_NOT_INSTALLED', 'Install the selected official CLI on the server and sign in with your subscription first.');
        }
        if (!hosted && active) throw new AppError(429, 'ANALYSIS_BUSY', 'Another analysis is already running. Wait for it to finish.');
        if (!hosted) active = true;
        const controller = new AbortController();
        res.on('close', () => { if (!res.writableEnded) controller.abort(); });
        try { return send(200, await analyzeIdea(input, { apiKey: settings.apiKey, provider, model: settings.model, fetchImpl, cliRunner, cliCommands, cliModels, timeoutMs, signal: controller.signal })); }
        finally { if (!hosted) active = false; }
      }
      if (['/api/status', '/api/analyze', '/api/settings', '/api/settings/test'].includes(url.pathname)) throw new AppError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
      if (url.pathname.startsWith('/api/')) throw new AppError(404, 'NOT_FOUND', 'This route does not exist.');
      if (!['GET', 'HEAD'].includes(req.method)) throw new AppError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch { throw new AppError(400, 'INVALID_PATH', 'Invalid path.'); }
      if (pathname.includes('\0') || pathname.split('/').some((part) => part.startsWith('.'))) throw new AppError(404, 'NOT_FOUND', 'File not found.');
      const candidate = path.resolve(publicRoot, pathname === '/' ? 'index.html' : `.${pathname}`);
      if (!candidate.startsWith(`${publicRoot}${path.sep}`)) throw new AppError(404, 'NOT_FOUND', 'File not found.');
      let filePath;
      try { filePath = await realpath(candidate); }
      catch { throw new AppError(404, 'NOT_FOUND', 'File not found.'); }
      if (!filePath.startsWith(`${publicRoot}${path.sep}`) || !mimeTypes[path.extname(filePath)]) throw new AppError(404, 'NOT_FOUND', 'File not found.');
      const content = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)], 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      const status = error instanceof AppError ? error.status : 500;
      send(status, { error: error instanceof AppError ? error.message : 'The request could not be completed.', code: error instanceof AppError ? error.code : 'INTERNAL_ERROR' });
    }
  });
  server.requestTimeout = hosted ? 285000 : 520000;
  server.headersTimeout = 15000;
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  const server = createApplication();
  server.listen(port, host, () => console.log(`Idea Lab available at http://${host === '0.0.0.0' ? 'localhost' : host}:${server.address().port}`));
  server.on('error', (error) => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Set PORT to another value to start Idea Lab.` : 'Idea Lab could not start.'); process.exitCode = 1; });
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
}
