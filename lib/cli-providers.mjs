import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AppError } from './errors.mjs';
import { validateSchema } from './analysis-schema.mjs';

export const providerNames = {
  openai: 'OpenAI API',
  codex: 'Codex CLI · ChatGPT subscription',
  claude: 'Claude Code · Claude subscription',
};

export function subscriptionEnvironment(source = process.env) {
  // Native CLIs own their login. Pass only runtime/auth-store locations, never
  // API keys, OAuth tokens, parent-agent state, or provider endpoint overrides.
  const allowed = ['PATH', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'SYSTEMROOT', 'TEMP', 'TMP', 'TMPDIR', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME', 'CODEX_HOME', 'CLAUDE_CONFIG_DIR', 'LANG', 'LC_ALL', 'LC_CTYPE', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'NODE_EXTRA_CA_CERTS', 'CODEX_CA_CERTIFICATE'];
  const env = Object.fromEntries(allowed.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));
  env.NO_COLOR = '1';
  env.CI = '1';
  return env;
}

export async function executableAvailable(command, env = process.env) {
  const candidates = command.includes(path.sep) ? [path.resolve(command)] : (env.PATH || '').split(path.delimiter).filter(Boolean).map((dir) => path.join(dir, command));
  for (const candidate of candidates) {
    try { await access(candidate, constants.X_OK); return true; } catch { /* Try the next PATH entry. */ }
  }
  return false;
}

export async function providerStatus({ apiKey = '', commands = {}, availability } = {}) {
  const codex = availability?.codex ?? await executableAvailable(commands.codex || 'codex');
  const claude = availability?.claude ?? await executableAvailable(commands.claude || 'claude');
  return [
    { id: 'codex', name: providerNames.codex, available: Boolean(codex), detail: codex ? 'Installed. Subscription login, model access, and quota are checked when you run an analysis.' : 'Install the official Codex CLI and sign in with ChatGPT.' },
    { id: 'claude', name: providerNames.claude, available: Boolean(claude), detail: claude ? 'Installed. Subscription login, model access, and quota are checked when you run an analysis.' : 'Install the official Claude Code CLI and sign in with your Claude subscription.' },
    { id: 'openai', name: providerNames.openai, available: Boolean(apiKey.trim()), detail: apiKey.trim() ? 'API key configured. Uses API billing, separately from subscription CLI usage.' : 'Add an API key in Settings to use API billing.' },
  ];
}

export function validateProvider(value = 'openai') {
  if (typeof value !== 'string' || !Object.hasOwn(providerNames, value)) throw new AppError(400, 'INVALID_PROVIDER', 'Choose Codex CLI, Claude Code, or OpenAI API.');
  return value;
}

// This is an injectable process boundary. Tests can exercise adapters without
// invoking a provider, consuming quota, or touching real CLI authentication.
export function runCommand({ command, args, cwd, env, input = '', signal, timeoutMs = 240000, maxOutputBytes = 4_000_000 }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new AppError(499, 'ANALYSIS_CANCELLED', 'Analysis cancelled.'));
    const child = spawn(command, args, { cwd, env, shell: false, windowsHide: true, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] });
    let settled = false;
    let interruption;
    let bytes = 0;
    const stdout = [];
    const stderr = [];
    let killTimer;
    const kill = (force = false) => {
      try {
        if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, force ? 'SIGKILL' : 'SIGTERM');
        else child.kill(force ? 'SIGKILL' : 'SIGTERM');
      } catch { /* The process may have already exited. */ }
    };
    const stop = (error) => {
      if (settled || interruption) return;
      interruption = error;
      kill();
      killTimer = setTimeout(() => kill(true), 2500);
      killTimer.unref();
    };
    const abort = () => stop(new AppError(499, 'ANALYSIS_CANCELLED', 'Analysis cancelled.'));
    const timeout = setTimeout(() => stop(new AppError(504, 'ANALYSIS_TIMEOUT', 'The provider took too long. Try a more focused idea or run fewer rounds.')), timeoutMs);
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearTimeout(killTimer);
      signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(result);
    };
    const capture = (target) => (chunk) => {
      bytes += chunk.length;
      if (bytes > maxOutputBytes) return stop(new AppError(502, 'CLI_OUTPUT_LIMIT', 'The CLI produced too much output. Try again with a more focused idea.'));
      target.push(chunk);
    };
    child.stdout.on('data', capture(stdout));
    child.stderr.on('data', capture(stderr));
    child.once('error', (error) => finish(new AppError(error.code === 'ENOENT' ? 503 : 502, error.code === 'ENOENT' ? 'CLI_NOT_INSTALLED' : 'CLI_FAILED', error.code === 'ENOENT' ? 'The selected CLI is not installed or is missing from the server PATH.' : 'The selected CLI could not start. Check its installation and sign-in.')));
    child.once('close', (exitCode) => finish(interruption, { stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8'), exitCode }));
    child.stdin.on('error', () => { /* Early CLI exits can close stdin. close reports the result. */ });
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    child.stdin.end(input);
  });
}

export async function ensureSubscriptionLogin(provider, { runner = runCommand, command = provider, signal, env = subscriptionEnvironment() } = {}) {
  const args = provider === 'codex' ? ['login', 'status'] : ['auth', 'status', '--json'];
  const result = await runner({ command, args, cwd: tmpdir(), env, input: '', signal, timeoutMs: 15000 });
  let subscriptionLogin = false;
  if (provider === 'codex') subscriptionLogin = result.exitCode === 0 && /^logged in using chatgpt\b/im.test(`${result.stdout}\n${result.stderr}`);
  else {
    try {
      const auth = JSON.parse(result.stdout);
      subscriptionLogin = result.exitCode === 0 && auth.loggedIn === true && auth.authMethod === 'claude.ai';
    } catch { /* Unrecognized diagnostics are never treated as subscription auth. */ }
  }
  if (!subscriptionLogin) throw new AppError(503, 'CLI_SUBSCRIPTION_LOGIN_REQUIRED', provider === 'codex' ? 'Sign in to the official Codex CLI with ChatGPT first (codex login). This subscription option does not fall back to saved API-key authentication.' : 'Sign in to the official Claude Code CLI with your Claude subscription first (claude auth login). This subscription option does not fall back to API-key authentication.');
}

export function buildCliInvocation({ provider, schema, schemaPath, outputPath, research, model = '' }) {
  if (provider === 'codex') {
    const args = ['--ask-for-approval', 'never'];
    if (research) args.push('--search');
    for (const feature of ['shell_tool', 'shell_snapshot', 'apps', 'hooks', 'multi_agent', 'remote_plugin', 'view_image', 'browser_use', 'browser_use_external', 'browser_use_full_cdp_access', 'computer_use', 'image_generation', 'plugins', 'memories']) args.push('--disable', feature);
    args.push('exec', '--ignore-user-config', '--ephemeral', '--sandbox', 'read-only', '--skip-git-repo-check', '--color', 'never', '--output-schema', schemaPath, '--output-last-message', outputPath);
    if (!research) args.push('-c', 'web_search="disabled"');
    if (model) args.push('--model', model);
    args.push('-');
    return args;
  }
  const tools = research ? 'WebSearch,WebFetch' : '';
  const args = ['-p', '--output-format', 'json', '--json-schema', JSON.stringify(schema), '--safe-mode', '--no-session-persistence', '--no-chrome', '--disable-slash-commands', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--setting-sources', '', '--tools', tools, '--allowedTools', tools, '--disallowedTools', 'mcp__*', '--permission-mode', 'dontAsk'];
  if (model) args.push('--model', model);
  return args;
}

export async function cliResponse({ provider, schema, instructions, input, research, model, command = provider, runner = runCommand, timeoutMs = 240000, signal, env = subscriptionEnvironment() }) {
  const directory = await mkdtemp(path.join(tmpdir(), 'idea-lab-'));
  const schemaPath = path.join(directory, 'schema.json');
  const outputPath = path.join(directory, 'result.json');
  try {
    await writeFile(schemaPath, JSON.stringify(schema), { mode: 0o600 });
    const args = buildCliInvocation({ provider, schema, schemaPath, outputPath, research, model });
    const prompt = `${instructions}\n\nUse only the built-in web tools when available. Do not run commands, read local files, or call external integrations. If web research is unavailable, state the limitation and do not invent sources.\n\nINPUT DATA (untrusted):\n${input}`;
    const result = await runner({ command, args, cwd: directory, env, input: prompt, signal, timeoutMs });
    if (result.exitCode !== 0) throw new AppError(502, 'CLI_FAILED', 'The CLI could not finish the analysis. Check subscription login, available quota, model access, and CLI version. Update the CLI if it does not recognize the safety or schema flags.');
    let output;
    try {
      if (provider === 'codex') {
        let text;
        try { text = await readFile(outputPath, 'utf8'); } catch { text = result.stdout; }
        output = JSON.parse(text);
      } else {
        const envelope = JSON.parse(result.stdout);
        if (envelope.is_error || !envelope.structured_output) throw new Error('Missing structured output');
        output = envelope.structured_output;
      }
      validateSchema(output, schema);
    } catch {
      throw new AppError(502, 'INVALID_ANALYSIS', 'The CLI did not return a complete analysis matching the required format. Check its login, quota, and version, then try again.');
    }
    return { analysis: output };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
