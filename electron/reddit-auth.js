// Reddit OAuth2 (authorization-code flow with a loopback redirect).
// Works with "installed app" credentials (client ID only) or "web app"/"script" ones (ID + secret).
// The client secret and refresh token are kept encrypted with the OS keystore via safeStorage.
const http = require('http');
const crypto = require('crypto');
const { app, shell, safeStorage } = require('electron');
const store = require('./store');

const PORT = 65010;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
const SCOPES = 'identity read mysubreddits';
const LOGIN_TIMEOUT_MS = 3 * 60_000;

let access = null; // { token, expiresAt } — memory only
let refreshing = null;
let pending = null; // in-flight browser login: { cancel }
const listeners = new Set();

const cfg = () => (store.get().reddit ||= {});

async function seal(s) {
  if (!s) return null;
  return (await safeStorage.isAsyncEncryptionAvailable())
    ? { v: (await safeStorage.encryptStringAsync(s)).toString('base64'), enc: true }
    : { v: s, enc: false };
}

// Decrypt cfg()[key], re-sealing it if the OS rotated the encryption key.
async function reveal(key) {
  const box = cfg()[key];
  if (!box) return null;
  if (!box.enc) return box.v;
  try {
    const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(Buffer.from(box.v, 'base64'));
    if (shouldReEncrypt) {
      cfg()[key] = await seal(result);
      store.save();
    }
    return result;
  } catch {
    return null;
  }
}

const userAgent = () => `desktop:neonwire:${app.getVersion()} (by /u/${cfg().username || 'anonymous'})`;
const basicAuth = async () => `Basic ${Buffer.from(`${cfg().clientId}:${(await reveal('secret')) || ''}`).toString('base64')}`;

function status() {
  const c = cfg();
  return {
    clientId: c.clientId || '',
    hasSecret: !!c.secret,
    loggedIn: !!c.refresh,
    username: c.username || '',
    pending: !!pending,
    redirectUri: REDIRECT_URI,
  };
}

function changed() {
  const s = status();
  listeners.forEach((fn) => fn(s));
}

const onChange = (fn) => listeners.add(fn);
const isLoggedIn = () => !!cfg().refresh;

async function tokenRequest(params) {
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: { Authorization: await basicAuth(),'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': userAgent() },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const err = new Error(`Reddit token request failed: ${json.error || `HTTP ${res.status}`}`);
    err.fatal = res.status === 400 || res.status === 401 || json.error === 'invalid_grant';
    throw err;
  }
  access = { token: json.access_token, expiresAt: Date.now() + (json.expires_in || 3600) * 1000 };
  return json;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const page = (title, msg, ok) => `<!doctype html><meta charset="utf-8"><title>NEONWIRE</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#07060d;color:#ece9ff;font:16px Consolas,monospace">
<div style="text-align:center;padding:40px 60px;border:1px solid ${ok ? '#00f0ff' : '#ff3860'};box-shadow:0 0 40px -10px ${ok ? '#00f0ff' : '#ff3860'}">
<h1 style="letter-spacing:.2em;color:${ok ? '#00f0ff' : '#ff3860'};text-shadow:0 0 12px currentColor">${esc(title)}</h1><p>${esc(msg)}</p></div>`;

// Start a one-shot loopback server, open the browser, resolve with the auth code.
function waitForCode(authUrl, state) {
  return new Promise((resolve, reject) => {
    let done = false;
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, REDIRECT_URI);
      if (u.pathname !== '/callback') return res.writeHead(404).end();
      const error = u.searchParams.get('error');
      const code = u.searchParams.get('code');
      const ok = !error && code && u.searchParams.get('state') === state;
      // Connection: close so a browser can't keep-alive into this one-shot server and
      // deliver a later login's callback to it.
      res
        .writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', Connection: 'close' })
        .end(ok ? page('LINK ESTABLISHED', 'You can close this tab and return to NEONWIRE.', true) : page('LINK REFUSED', `Reddit said: ${error || 'state mismatch'}`, false));
      if (ok) finish(null, code);
      else finish(new Error(error === 'access_denied' ? 'Login was declined in the browser' : `Login failed: ${error || 'state mismatch'}`));
    });
    const timer = setTimeout(() => finish(new Error('Login timed out — no response from the browser')), LOGIN_TIMEOUT_MS);

    function finish(err, code) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      server.close();
      server.closeIdleConnections();
      pending = null;
      if (err) reject(err);
      else resolve(code);
    }

    pending = { cancel: () => finish(new Error('Login cancelled')) };
    server.on('error', (e) =>
      finish(e.code === 'EADDRINUSE' ? new Error(`Port ${PORT} is in use — close whatever holds it and retry`) : e),
    );
    server.listen(PORT, '127.0.0.1', () => shell.openExternal(authUrl));
  });
}

async function login({ clientId, clientSecret }) {
  pending?.cancel();
  const c = cfg();
  c.clientId = String(clientId || '').trim();
  if (!c.clientId) throw new Error('Client ID is required');
  if (typeof clientSecret === 'string') c.secret = await seal(clientSecret.trim()); // '' clears, undefined keeps
  store.save();

  const state = crypto.randomBytes(16).toString('hex');
  const authUrl = `https://www.reddit.com/api/v1/authorize?${new URLSearchParams({
    client_id: c.clientId,
    response_type: 'code',
    state,
    redirect_uri: REDIRECT_URI,
    duration: 'permanent',
    scope: SCOPES,
  })}`;

  const codePromise = waitForCode(authUrl, state);
  changed();
  let code;
  try {
    code = await codePromise;
  } finally {
    changed();
  }

  const tok = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI });
  if (!tok.refresh_token) throw new Error('Reddit did not return a refresh token');
  c.refresh = await seal(tok.refresh_token);
  const me = await api('/api/v1/me');
  c.username = me?.name || '';
  store.save();
  changed();
  return status();
}

function cancel() {
  pending?.cancel();
}

function clearSession() {
  const c = cfg();
  delete c.refresh;
  delete c.username;
  access = null;
  store.save();
  changed();
}

async function logout() {
  pending?.cancel();
  const refresh = await reveal('refresh');
  if (refresh) {
    await fetch('https://www.reddit.com/api/v1/revoke_token', {
      method: 'POST',
      headers: { Authorization: await basicAuth(),'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': userAgent() },
      body: new URLSearchParams({ token: refresh, token_type_hint: 'refresh_token' }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => {}); // best effort — the local session is dropped either way
  }
  clearSession();
  return status();
}

async function getToken(force = false) {
  const c = cfg();
  if (!c.refresh) return null;
  if (!force && access && access.expiresAt - 60_000 > Date.now()) return access.token;
  refreshing ||= reveal('refresh')
    .then((refreshToken) => tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken || '' }))
    .catch((err) => {
      if (err.fatal) clearSession(); // revoked or bad credentials: fall back to anonymous
      throw err;
    })
    .finally(() => {
      refreshing = null;
    });
  await refreshing;
  return access.token;
}

// GET an oauth.reddit.com path. Returns null when not logged in.
async function api(path) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getToken(attempt > 0);
    if (!token) return null;
    const res = await fetch(`https://oauth.reddit.com${path}`, {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': userAgent() },
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 401 && attempt === 0) continue;
    if (!res.ok) throw new Error(`Reddit API HTTP ${res.status}`);
    return res.json();
  }
  return null;
}

module.exports = { status, onChange, isLoggedIn, login, cancel, logout, api };
