import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { once } from 'node:events';
import { analyzeIdea, createApplication, validateInput } from '../server.mjs';

let server;
let base;

before(async () => {
  server = createApplication({ apiKey: '' });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  base = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (server?.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

test('public status reports missing credentials without exposing configuration', async () => {
  const response = await fetch(`${base}/api/status`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.configured, false);
  assert.equal(typeof data.model, 'string');
  assert.ok(data.model.length > 0);
  assert.equal(Object.keys(data).some(key => /key|token|secret|env/i.test(key)), false);
  assert.deepEqual(data.providers.map(provider => provider.id), ['codex', 'claude', 'openai']);
  assert.equal(data.providers.find(provider => provider.id === 'openai').available, false);
});

test('the application is served as HTML', async () => {
  const response = await fetch(`${base}/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(await response.text(), /<html\b/i);
});

test('invalid input cannot trigger research', async () => {
  const response = await fetch(`${base}/api/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idea: '', audience: '', market: '', goal: '' }),
  });
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.equal(typeof data.error, 'string');
  assert.ok(data.error.length > 0);
  assert.equal('jtbd' in data, false);
});

test('iteration context is optional, preserved as text and bounded before research', () => {
  const { input } = analysisFixtures();
  assert.deepEqual(validateInput(input), input);
  assert.deepEqual(validateInput({ ...input, context: '   ' }), input);
  assert.equal(validateInput({ ...input, context: '  Two interviews question how often the problem occurs.  ' }).context, 'Two interviews question how often the problem occurs.');
  assert.equal(validateInput({ ...input, context: 'x'.repeat(8000) }).context.length, 8000);
  for (const context of ['x'.repeat(8001), [], {}, null, 42]) {
    assert.throws(() => validateInput({ ...input, context }), error => error.status === 400 && error.code === 'INVALID_INPUT');
  }
});

test('malformed JSON is rejected with a useful error', async () => {
  const response = await fetch(`${base}/api/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{',
  });
  assert.equal(response.status, 400);
  assert.equal(typeof (await response.json()).error, 'string');
});

test('without a key the server returns an explicit error instead of fabricated analysis', async () => {
  const response = await fetch(`${base}/api/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      idea: 'An application that helps small consulting teams detect blocked tasks before their weekly meeting.',
      audience: 'Managers of consulting teams with five to fifteen people',
      market: 'Spain',
      goal: 'Reduce time spent in progress meetings.',
    }),
  });
  assert.equal(response.status, 503);
  const data = await response.json();
  assert.equal(typeof data.error, 'string');
  assert.ok(data.error.length > 0);
  assert.equal('competitors' in data, false);
  assert.equal('jtbd' in data, false);
});

test('the research endpoint rejects the wrong HTTP method', async () => {
  const response = await fetch(`${base}/api/analyze`);
  assert.equal(response.status, 405);
});

test('server source and parent paths are not exposed as static resources', async () => {
  for (const path of ['/server.mjs', '/..%2fpackage.json', '/%2e%2e%2f.env']) {
    const response = await new Promise((resolve, reject) => {
      const req = request(`${base}`, { path, method: 'GET' }, res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
      });
      req.on('error', reject);
      req.end();
    });
    assert.ok(response.status >= 400, `${path} should not be served`);
    assert.doesNotMatch(response.body, /OPENAI_API_KEY\s*=/);
  }
});

function analysisFixtures() {
  const input = { idea: 'Help small teams detect blockers before their meetings.', audience: 'Small teams', market: 'Spain', goal: 'Reduce meetings' };
  const problem = {
    jtbd: [{ id: 'j1', situation: 'Before a meeting', motivation: 'Detect blockers', outcome: 'Less time spent tracking progress', priority: 'high' }],
    requirements: [{ id: 'r1', title: 'Show blockers', why: 'Avoid reviewing every task', metric: 'Meeting preparation time', jobIds: ['j1'] }],
  };
  const market = {
    summary: { title: 'Visible blockers', thesis: 'A narrow segment may need less tracking', verdict: 'Unproven hypothesis', nextStep: 'Interview teams' },
    competitors: [{ id: 'c1', name: 'Fictional test example', type: 'indirect', description: 'An alternative', strength: 'Shared information', gap: 'Needs verification', sourceUrl: 'https://unverified.test/product', sourceTitle: 'Reference not returned', requirementIds: ['r1'] }],
    counterIdeas: [{ id: 'x1', title: 'The problem may be small', argument: 'The meeting may already solve it', severity: 'high', falsificationTest: 'Measure ten meetings' }],
    refinements: [{ id: 'f1', title: 'Distributed teams', audience: 'Small distributed teams', problem: 'Undetected blockers', differentiation: 'Asynchronous context', experiment: 'Prototype with three teams', successCriterion: 'Observable time reduction' }],
    evidence: [
      { id: 'e1', claim: 'The test page contains a description', status: 'supported', sourceUrl: 'https://example.test/product', sourceTitle: 'Test page', observedAt: '2026-11-19', note: 'Claim bounded to the source' },
      { id: 'e2', claim: 'Willingness to pay exists', status: 'supported', sourceUrl: 'https://unverified.test/sales', sourceTitle: 'Reference not returned', observedAt: '2026-11-19', note: 'Claim without a corroborated source' },
    ],
    limitations: ['Interviews required'],
    iteration: { decision: 'continue', rationale: 'A focused research question remains.', weakestAssumption: 'The job occurs frequently enough.', changeSummary: 'Initial baseline.', selectedRefinementId: 'f1', newInformation: 'No new customer evidence.', remainingRisks: ['Willingness to pay is unknown.'] },
  };
  return { input, problem, market };
}

function providerResponse(analysis, search = null) {
  const output = [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(analysis), annotations: [] }] }];
  if (search) output.unshift(search);
  return new Response(JSON.stringify({ status: 'completed', output }), { status: 200, headers: { 'content-type': 'application/json' } });
}

test('research follows JTBD requirements and downgrades references absent from native search results', async () => {
  const { input, problem, market } = analysisFixtures();
  input.context = 'Previous iteration: the main objection is that the blocker is already detected in the meeting. Unverified observation: two teams say they review their tasks daily.';
  const requests = [];
  const result = await analyzeIdea(input, {
    apiKey: 'test-only-never-sent',
    fetchImpl: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return requests.length === 1
        ? providerResponse(problem)
        : providerResponse(market, { type: 'web_search_call', status: 'completed', action: { sources: [{ url: 'https://example.test/product', title: 'Source returned by search' }] } });
    },
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].tools, undefined);
  assert.equal(requests[1].tools[0].type, 'web_search');
  assert.equal(requests[1].tool_choice, 'required');
  assert.equal(JSON.parse(requests[0].input).idea.context, input.context);
  assert.equal(JSON.parse(requests[1].input).idea.context, input.context);
  assert.deepEqual(JSON.parse(requests[1].input).problem, problem);
  assert.equal(result.input.context, input.context);
  assert.equal(result.mode, 'live');
  assert.equal(result.evidence[0].status, 'supported');
  assert.equal(result.evidence[0].sourceTitle, 'Source returned by search');
  assert.equal(result.evidence[1].status, 'hypothesis');
  assert.equal(result.evidence[1].sourceUrl, '');
  assert.equal(result.competitors[0].sourceUrl, '');
  assert.equal(result.sources.length, 1);
  assert.match(result.limitations.join(' '), /remain unverified/i);
  assert.equal(JSON.stringify(result).includes('test-only-never-sent'), false);
});

test('an analysis without completed web research is rejected', async () => {
  const { input, problem, market } = analysisFixtures();
  let calls = 0;
  await assert.rejects(analyzeIdea(input, {
    apiKey: 'test-only-never-sent',
    fetchImpl: async () => providerResponse(++calls === 1 ? problem : market),
  }), error => error.code === 'RESEARCH_MISSING' && error.status === 502);
  assert.equal(calls, 2);
});
