import { chmod, lstat, mkdir, open, rename, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { AppError } from './errors.mjs';
import { validateProvider } from './cli-providers.mjs';

const SETTINGS_LIMIT = 16_000;

export function validateModel(value, fallback) {
  if (typeof value !== 'string') throw new AppError(400, 'INVALID_MODEL', 'Enter a valid model name of at most 120 characters.');
  const model = value.trim() || fallback;
  if (model.length > 120 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(model) || /^sk-/i.test(model)) {
    throw new AppError(400, 'INVALID_MODEL', 'Enter a valid model name of at most 120 characters.');
  }
  return model;
}

export function validateSettingsPatch(body, fallbackModel) {
  const allowed = ['provider', 'apiKey', 'model', 'clearApiKey'];
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !allowed.includes(key))) {
    throw new AppError(400, 'INVALID_SETTINGS', 'Send only the provider, API key, model, or clear-key preference.');
  }
  const patch = {};
  if (Object.hasOwn(body, 'provider')) patch.provider = validateProvider(body.provider);
  if (Object.hasOwn(body, 'model')) patch.model = validateModel(body.model, fallbackModel);
  if (Object.hasOwn(body, 'clearApiKey')) {
    if (typeof body.clearApiKey !== 'boolean') throw new AppError(400, 'INVALID_SETTINGS', 'The clear-key preference must be true or false.');
    patch.clearApiKey = body.clearApiKey;
  }
  if (Object.hasOwn(body, 'apiKey')) {
    if (typeof body.apiKey !== 'string' || body.apiKey.length > 512) throw new AppError(400, 'INVALID_API_KEY', 'Enter an API key of at most 512 characters.');
    const key = body.apiKey.trim();
    if (key && (key.length < 8 || !/^[!-~]+$/.test(key))) throw new AppError(400, 'INVALID_API_KEY', 'The API key format is invalid.');
    if (key) patch.apiKey = key;
  }
  if (patch.clearApiKey && patch.apiKey) throw new AppError(400, 'INVALID_SETTINGS', 'Save a new key or remove the key in separate actions.');
  return patch;
}

/** The only module that reads/writes application API credentials. Never serialize
 * its private results into an HTTP response; use sanitizedSettings instead. */
export function createSettingsStore({ directory = null, environmentApiKey = '', defaultModel = 'gpt-6.2-astra', defaultProvider = 'openai' } = {}) {
  const root = directory ? path.resolve(directory) : null;
  const settingsPath = root ? path.join(root, 'settings.json') : null;
  let memory = {};
  let writes = Promise.resolve();

  function checkStored(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !['provider', 'model', 'apiKey', 'apiKeyDisabled'].includes(key))) throw new Error('Invalid settings');
    if (value.provider !== undefined) validateProvider(value.provider);
    if (value.model !== undefined) validateModel(value.model, defaultModel);
    if (value.apiKey !== undefined && (typeof value.apiKey !== 'string' || value.apiKey.length < 8 || value.apiKey.length > 512 || !/^[!-~]+$/.test(value.apiKey))) throw new Error('Invalid key');
    if (value.apiKeyDisabled !== undefined && typeof value.apiKeyDisabled !== 'boolean') throw new Error('Invalid key preference');
    return value;
  }

  async function readStored() {
    if (!root) return { ...memory };
    let handle;
    try {
      let info;
      try { info = await lstat(root); } catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
      if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Invalid settings directory');
      await chmod(root, 0o700);
      try { handle = await open(settingsPath, constants.O_RDONLY | constants.O_NOFOLLOW); }
      catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
      const file = await handle.stat();
      if (!file.isFile() || file.size > SETTINGS_LIMIT) throw new Error('Invalid settings file');
      await handle.chmod(0o600);
      return checkStored(JSON.parse(await handle.readFile('utf8')));
    } catch {
      throw new AppError(500, 'SETTINGS_UNAVAILABLE', 'Local settings could not be read securely. Check the settings folder permissions.');
    } finally { await handle?.close(); }
  }

  function effective(value) {
    const apiKey = value.apiKeyDisabled ? '' : value.apiKey || environmentApiKey.trim();
    const model = value.model || defaultModel;
    if (apiKey && model.includes(apiKey)) throw new AppError(500, 'SETTINGS_UNAVAILABLE', 'The model setting cannot contain an API credential.');
    return { provider: value.provider || defaultProvider, model, apiKey, apiKeyConfigured: Boolean(apiKey), apiKeySource: !apiKey ? 'none' : value.apiKey ? 'saved' : 'environment' };
  }

  async function persist(value) {
    if (!root) { memory = { ...value }; return; }
    let temporary;
    try {
      await mkdir(root, { recursive: true, mode: 0o700 });
      const info = await lstat(root);
      if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Invalid directory');
      await chmod(root, 0o700);
      // Replace atomically so a restart cannot observe a partial secret file.
      // O_EXCL and O_NOFOLLOW prevent overwriting an unrelated file or symlink.
      temporary = path.join(root, `.settings-${randomUUID()}.tmp`);
      const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try {
        await handle.writeFile(`${JSON.stringify(value)}\n`, 'utf8');
        await handle.sync();
      } finally { await handle.close(); }
      await rename(temporary, settingsPath);
      temporary = null;
    } catch {
      throw new AppError(500, 'SETTINGS_UNAVAILABLE', 'Local settings could not be saved securely. Check the settings folder permissions.');
    } finally { if (temporary) await rm(temporary, { force: true }).catch(() => {}); }
  }

  return {
    async get() { await writes; return effective(await readStored()); },
    async update(body) {
      const patch = validateSettingsPatch(body, defaultModel);
      const operation = writes.then(async () => {
        const stored = await readStored();
        if (patch.provider !== undefined) stored.provider = patch.provider;
        if (patch.model !== undefined) stored.model = patch.model;
        if (patch.clearApiKey) { delete stored.apiKey; stored.apiKeyDisabled = true; }
        else if (patch.apiKey) { stored.apiKey = patch.apiKey; delete stored.apiKeyDisabled; }
        const credential = stored.apiKeyDisabled ? '' : stored.apiKey || environmentApiKey.trim();
        if (credential && (stored.model || defaultModel).includes(credential)) throw new AppError(400, 'INVALID_MODEL', 'The model setting cannot contain an API credential.');
        const result = effective(stored);
        await persist(stored);
        return result;
      });
      writes = operation.then(() => undefined, () => undefined);
      return operation;
    },
  };
}

export function sanitizedSettings(settings, providers) {
  return { provider: settings.provider, apiKeyConfigured: settings.apiKeyConfigured, apiKeySource: settings.apiKeySource, model: settings.model, providers, storage: 'local' };
}
