import { createApplication } from '../server.mjs';

// Reuse routing code without opening a listener or retaining visitor settings.
// Each hosted request reconstructs its own settings from its encrypted cookie.
const application = createApplication({ hosted: true });
const requestHandler = application.listeners('request')[0];

export default function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/api/index') {
      const routes = url.searchParams.getAll('route');
      const known = ['status', 'settings', 'settings/test', 'analyze'];
      req.url = routes.length === 1 && known.includes(routes[0]) ? `/api/${routes[0]}` : '/api/__unknown';
    }
  } catch { req.url = '/api/__unknown'; }
  return requestHandler(req, res);
}
