import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeIdea } from '../server.mjs';
import { subscriptionEnvironment, buildCliInvocation } from '../lib/cli-providers.mjs';
import { problemSchema, marketSchema } from '../lib/analysis-schema.mjs';
import { createExample } from '../public/examples.mjs';

function fixture() {
  const analysis = createExample('office-lunch').rounds[2];
  const pick = schema => Object.fromEntries(Object.keys(schema.properties).map(key => [key, analysis[key]]));
  return { input: analysis.input, problem: pick(problemSchema), market: pick(marketSchema) };
}

test('subscription subprocesses receive native login locations without inherited API keys or tokens', () => {
  const env = subscriptionEnvironment({
    PATH: '/usr/local/bin', HOME: '/tmp/native-login-home', CODEX_HOME: '/tmp/native-codex', CLAUDE_CONFIG_DIR: '/tmp/native-claude',
    OPENAI_API_KEY: 'test-key', ANTHROPIC_API_KEY: 'test-key', CODEX_API_KEY: 'test-key', CODEX_ACCESS_TOKEN: 'test-token', CLAUDE_CODE_OAUTH_TOKEN: 'test-token',
    OPENAI_BASE_URL: 'https://untrusted.test', ANTHROPIC_BASE_URL: 'https://untrusted.test', CODEX_THREAD_ID: 'parent-context',
  });
  assert.equal(env.HOME, '/tmp/native-login-home');
  assert.equal(env.CODEX_HOME, '/tmp/native-codex');
  assert.equal(env.CLAUDE_CONFIG_DIR, '/tmp/native-claude');
  assert.equal(env.CI, '1');
  assert.equal(Object.keys(env).some(key => /API_KEY|TOKEN|BASE_URL|THREAD_ID/.test(key)), false);
});

test('CLI research invocations restrict execution and integrations while requesting structured output', () => {
  const codex = buildCliInvocation({ provider: 'codex', schema: marketSchema, schemaPath: '/tmp/schema.json', outputPath: '/tmp/result.json', research: true });
  assert.ok(codex.includes('--search'));
  assert.ok(codex.includes('--output-schema'));
  assert.ok(codex.includes('--ignore-user-config'));
  assert.equal(codex[codex.indexOf('--sandbox') + 1], 'read-only');
  assert.ok(codex.includes('shell_tool'));
  assert.equal(codex.includes('--dangerously-bypass-approvals-and-sandbox'), false);
  const claude = buildCliInvocation({ provider: 'claude', schema: marketSchema, research: true });
  assert.equal(claude[claude.indexOf('--tools') + 1], 'WebSearch,WebFetch');
  assert.ok(claude.includes('--strict-mcp-config'));
  assert.ok(claude.includes('--json-schema'));
  assert.ok(claude.includes('--safe-mode'));
  assert.equal(claude.includes('--dangerously-skip-permissions'), false);
});

for (const provider of ['codex', 'claude']) {
  test(`${provider} subscription adapter checks native login before both phases without a real CLI call`, async () => {
    const { input, problem, market } = fixture();
    const calls = [];
    const result = await analyzeIdea(input, {
      provider,
      cliRunner: async invocation => {
        calls.push(invocation);
        if (calls.length === 1) return { exitCode: 0, stdout: provider === 'codex' ? '' : JSON.stringify({ loggedIn: true, authMethod: 'claude.ai' }), stderr: provider === 'codex' ? 'Logged in using ChatGPT' : '' };
        const output = calls.length === 2 ? problem : market;
        return { exitCode: 0, stdout: JSON.stringify(provider === 'claude' ? { structured_output: output } : output), stderr: '' };
      },
      fetchImpl: () => { throw new Error('The API must not be called for a subscription provider.'); },
    });
    assert.equal(calls.length, 3);
    assert.deepEqual(calls[0].args, provider === 'codex' ? ['login', 'status'] : ['auth', 'status', '--json']);
    assert.match(calls[1].input, /INPUT DATA \(untrusted\)/);
    assert.ok(calls[2].input.includes(problem.jtbd[0].situation));
    assert.notEqual(calls[1].cwd, calls[2].cwd);
    assert.equal(result.provider.id, provider);
    assert.equal(result.provider.provenance, 'provider_reported');
    assert.ok(result.sources.every(source => source.provenance === 'provider_reported'));
    assert.match(result.limitations.join(' '), /does not independently corroborate/);
    assert.equal(Object.keys(calls[1].env).some(key => /API_KEY|TOKEN/.test(key)), false);
  });
}

test('saved API authentication cannot silently substitute for subscription login', async () => {
  const { input } = fixture();
  let calls = 0;
  await assert.rejects(analyzeIdea(input, {
    provider: 'codex',
    cliRunner: async () => { calls += 1; return { exitCode: 0, stdout: 'Logged in using an API key', stderr: '' }; },
  }), error => error.code === 'CLI_SUBSCRIPTION_LOGIN_REQUIRED');
  assert.equal(calls, 1);
});

test('CLI output without citable sources cannot continue an automatic research loop', async () => {
  const { input, problem, market } = fixture();
  market.iteration.decision = 'continue';
  for (const item of [...market.competitors, ...market.evidence]) { item.sourceUrl = ''; item.sourceTitle = ''; }
  let calls = 0;
  const result = await analyzeIdea(input, {
    provider: 'claude',
    cliRunner: async () => {
      calls += 1;
      const output = calls === 1 ? { loggedIn: true, authMethod: 'claude.ai' } : { structured_output: calls === 2 ? problem : market };
      return { exitCode: 0, stdout: JSON.stringify(output), stderr: '' };
    },
  });
  assert.equal(result.iteration.decision, 'test');
  assert.equal(result.sources.length, 0);
  assert.ok(result.evidence.every(item => item.status === 'hypothesis'));
  assert.match(result.iteration.rationale, /cannot continue without citable sources/);
});
