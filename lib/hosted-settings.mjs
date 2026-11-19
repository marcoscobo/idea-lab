import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { AppError } from './errors.mjs';
import { validateModel, validateSettingsPatch } from './settings-store.mjs';

export const HOSTED_COOKIE_NAME = '__Host-idea_lab_session';
export const HOSTED_SESSION_SECONDS = 24 * 60 * 60;
const MAX_COOKIE_VALUE = 3000;
const COOKIE_CONTEXT = Buffer.from('idea-lab:visitor-settings:v1', 'utf8');

export function sessionSecretReady(secret) {
  return typeof secret === 'string' && Buffer.byteLength(secret, 'utf8') >= 32;
}

function cookieValue(header) {
  if (typeof header !== 'string' || header.length > 16000) return '';
  const values = header.split(';').map((part) => part.trim()).filter((part) => part.startsWith(`${HOSTED_COOKIE_NAME}=`));
  if (values.length !== 1) return '';
  const value = values[0].slice(HOSTED_COOKIE_NAME.length + 1);
  return value.length <= MAX_COOKIE_VALUE && /^[A-Za-z0-9_-]+$/.test(value) ? value : '';
}

export function requireHostedProvider(provider) {
  if (provider !== 'openai') throw new AppError(403, 'HOSTED_PROVIDER_UNSUPPORTED', 'Subscription CLIs are available in the local application only. Use your own OpenAI API key for the online version.');
  return provider;
}

/** Request-scoped settings: no files, owner credentials, or shared visitor state.
 * Only authenticated encryption can restore a key from a previous browser save. */
export function createHostedSettings({ req, res, sessionSecret = '', defaultModel = 'gpt-6.2-astra', now = Date.now } = {}) {
  const ready = sessionSecretReady(sessionSecret);
  const encryptionKey = ready ? createHash('sha256').update(sessionSecret, 'utf8').digest() : null;

  function decode() {
    if (!ready) return {};
    const encoded = cookieValue(req.headers.cookie);
    if (!encoded) return {};
    try {
      const binary = Buffer.from(encoded, 'base64url');
      if (binary.length < 30 || binary[0] !== 1) return {};
      const decipher = createDecipheriv('aes-256-gcm', encryptionKey, binary.subarray(1, 13));
      decipher.setAAD(COOKIE_CONTEXT);
      decipher.setAuthTag(binary.subarray(13, 29));
      const plaintext = Buffer.concat([decipher.update(binary.subarray(29)), decipher.final()]);
      if (plaintext.length > 2000) return {};
      const value = JSON.parse(plaintext.toString('utf8'));
      const current = Math.floor(now() / 1000);
      if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !['v', 'iat', 'exp', 'provider', 'model', 'apiKey'].includes(key))) return {};
      if (value.v !== 1 || value.provider !== 'openai' || !Number.isInteger(value.iat) || !Number.isInteger(value.exp) || value.iat > current + 60 || value.exp <= current || value.exp > value.iat + HOSTED_SESSION_SECONDS || value.exp <= value.iat) return {};
      validateModel(value.model, defaultModel);
      const patch = validateSettingsPatch({ apiKey: value.apiKey || '' }, defaultModel);
      if (value.apiKey && !patch.apiKey) return {};
      if (value.apiKey && value.model.includes(value.apiKey)) return {};
      return { provider: 'openai', model: value.model, ...(patch.apiKey ? { apiKey: patch.apiKey } : {}) };
    } catch { return {}; }
  }

  let current = decode();
  const effective = () => ({ provider: 'openai', model: current.model || defaultModel, apiKey: current.apiKey || '', apiKeyConfigured: Boolean(current.apiKey), apiKeySource: current.apiKey ? 'saved' : 'none', needsSessionSecret: !ready });

  return {
    async get() { return effective(); },
    async update(body) {
      if (!ready) throw new AppError(503, 'HOSTED_SESSION_UNAVAILABLE', 'Online connection setup is not ready yet. The deployment owner must configure a stable IDEA_LAB_SESSION_SECRET of at least 32 bytes. Your API key was not saved.');
      const patch = validateSettingsPatch(body, defaultModel);
      if (patch.provider !== undefined) requireHostedProvider(patch.provider);
      const next = { ...current, provider: 'openai' };
      if (patch.model !== undefined) next.model = patch.model;
      if (patch.clearApiKey) delete next.apiKey;
      else if (patch.apiKey) next.apiKey = patch.apiKey;
      next.model ||= defaultModel;
      if (next.apiKey && next.model.includes(next.apiKey)) throw new AppError(400, 'INVALID_MODEL', 'The model setting cannot contain an API credential.');
      const issuedAt = Math.floor(now() / 1000);
      const payload = Buffer.from(JSON.stringify({ v: 1, iat: issuedAt, exp: issuedAt + HOSTED_SESSION_SECONDS, ...next }), 'utf8');
      const nonce = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', encryptionKey, nonce);
      cipher.setAAD(COOKIE_CONTEXT);
      const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
      const encoded = Buffer.concat([Buffer.from([1]), nonce, cipher.getAuthTag(), ciphertext]).toString('base64url');
      if (encoded.length > MAX_COOKIE_VALUE) throw new AppError(400, 'INVALID_SETTINGS', 'The connection settings are too large to save.');
      res.setHeader('Set-Cookie', `${HOSTED_COOKIE_NAME}=${encoded}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${HOSTED_SESSION_SECONDS}`);
      current = next;
      return effective();
    },
  };
}

export function hostedProviderStatus(apiKeyConfigured) {
  return [
    { id: 'codex', name: 'Codex CLI · ChatGPT subscription', available: false, detail: 'Local application only. Subscription CLIs do not run in this online deployment.' },
    { id: 'claude', name: 'Claude Code · Claude subscription', available: false, detail: 'Local application only. Subscription CLIs do not run in this online deployment.' },
    { id: 'openai', name: 'OpenAI API', available: Boolean(apiKeyConfigured), detail: apiKeyConfigured ? 'Your API key is available in this browser session. Requests use your own API billing.' : 'Add your own API key in Settings. This deployment does not provide a shared API key.' },
  ];
}
