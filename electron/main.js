const { app, BrowserWindow, ipcMain, shell, Notification } = require('electron');
const path = require('path');
const crypto = require('crypto');
const store = require('./store');
const { fetchSource, fetchThread } = require('./fetchers');

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const SOURCE_TYPES = ['hn', 'reddit', 'rss', 'json'];
const WATCH_POLL_MS = 60_000;
const MAX_HISTORY = 720;
const MAX_SEEN = 1500;

const feeds = {}; // sourceId -> { status, items, fetchedAt, error, nextAt }
const timers = {};
const gens = {}; // bumps on every reschedule so stale poll chains stop themselves
const logs = [];
let win = null;

// ---- plumbing --------------------------------------------------------------
function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function log(level, msg) {
  const entry = { t: Date.now(), level, msg };
  logs.push(entry);
  if (logs.length > 200) logs.shift();
  send('log', entry);
}

const findSource = (id) => store.get().sources.find((s) => s.id === id);
const feedFor = (id) => (feeds[id] ||= { status: 'idle', items: [], fetchedAt: null, error: null, nextAt: null });
const emitFeed = (id) => send('feed', { id, ...feedFor(id) });
const emitSources = () => send('sources', store.get().sources);
const emitWatch = () => send('watch', store.get().watch);

function openExternal(url) {
  if (/^https?:\/\//i.test(url || '')) shell.openExternal(url);
}

// ---- polling ---------------------------------------------------------------
function pruneSeen(map) {
  const entries = Object.entries(map);
  if (entries.length <= MAX_SEEN) return map;
  return Object.fromEntries(entries.sort((a, b) => b[1] - a[1]).slice(0, MAX_SEEN));
}

async function poll(src) {
  const feed = feedFor(src.id);
  if (feed.status === 'loading') return;
  feed.status = 'loading';
  emitFeed(src.id);

  const state = store.get();
  try {
    const items = await fetchSource(src);
    const firstRun = !state.seen[src.id];
    const seen = state.seen[src.id] || {};
    const now = Date.now();
    const fresh = [];
    for (const it of items) {
      if (!(it.key in seen)) {
        seen[it.key] = firstRun ? 0 : now; // don't flood "NEW" on a source's first sync
        if (!firstRun) fresh.push(it);
      }
      it.firstSeen = seen[it.key];
      it.sourceId = src.id;
    }
    state.seen[src.id] = pruneSeen(seen);
    Object.assign(feed, { status: 'ok', items, fetchedAt: now, error: null });

    if (trackFromItems(items)) emitWatch();
    if (fresh.length) {
      log('new', `${src.name} :: ${fresh.length} new → ${fresh[0].title}`);
      if (src.notify) notify(src, fresh);
    } else {
      log('info', `${src.name} :: synced ${items.length} items`);
    }
    store.save();
  } catch (err) {
    Object.assign(feed, { status: 'error', error: err.message, fetchedAt: Date.now() });
    log('error', `${src.name} :: ${err.message}`);
  }
  emitFeed(src.id);
}

function schedule(id, delayMs = 0) {
  clearTimeout(timers[id]);
  const gen = (gens[id] = (gens[id] || 0) + 1);
  const src = findSource(id);
  const feed = feedFor(id);
  if (!src || !src.enabled) {
    feed.nextAt = null;
    if (feed.status === 'loading') feed.status = 'idle';
    emitFeed(id);
    return;
  }
  feed.nextAt = Date.now() + delayMs;
  emitFeed(id);
  timers[id] = setTimeout(async () => {
    const current = findSource(id);
    if (!current) return;
    await poll(current);
    if (gens[id] === gen) schedule(id, Math.max(30, current.intervalSec || 120) * 1000);
  }, delayMs);
}

function notify(src, fresh) {
  if (!Notification.isSupported()) return;
  const n = new Notification({
    title: `${src.name} — ${fresh.length} new`,
    body: fresh.slice(0, 3).map((it) => `› ${it.title}`).join('\n'),
    silent: false,
  });
  n.on('click', () => win && (win.show(), win.focus()));
  n.show();
}

// ---- thread tracking -------------------------------------------------------
function record(entry, item) {
  if (!item) return false;
  const now = Date.now();
  const last = entry.history[entry.history.length - 1];
  if (item.title) entry.title = item.title;
  if (last && last.s === item.score && last.c === item.comments && now - last.t < 10 * 60_000) return false;
  entry.history.push({ t: now, s: item.score, c: item.comments });
  if (entry.history.length > MAX_HISTORY) entry.history.shift();
  return true;
}

function trackFromItems(items) {
  const byKey = new Map(items.map((it) => [it.key, it]));
  let changed = false;
  for (const entry of store.get().watch) changed = record(entry, byKey.get(entry.key)) || changed;
  return changed;
}

async function pollWatch() {
  const watch = store.get().watch.filter((e) => e.type === 'hn' || e.type === 'reddit');
  if (!watch.length) return;
  const results = await Promise.allSettled(watch.map(async (e) => record(e, await fetchThread(e))));
  if (results.some((r) => r.status === 'fulfilled' && r.value)) {
    store.save();
    emitWatch();
  }
}

// ---- IPC -------------------------------------------------------------------
function sanitizeSource(input, existing = {}) {
  const src = { ...existing, ...input };
  if (!SOURCE_TYPES.includes(src.type)) throw new Error(`Bad source type: ${src.type}`);
  src.id ||= `${src.type}-${crypto.randomUUID().slice(0, 8)}`;
  src.name = String(src.name || src.url || src.subreddit || src.type).slice(0, 80);
  src.intervalSec = Math.max(30, Number(src.intervalSec) || 120);
  src.enabled = src.enabled !== false;
  src.notify = !!src.notify;
  return src;
}

ipcMain.handle('state:get', () => {
  const { sources, watch } = store.get();
  return { sources, watch, feeds, logs };
});

ipcMain.handle('source:save', (_e, input) => {
  const state = store.get();
  const idx = state.sources.findIndex((s) => s.id === input.id);
  const src = sanitizeSource(input, idx >= 0 ? state.sources[idx] : {});
  if (idx >= 0) state.sources[idx] = src;
  else state.sources.push(src);
  store.save();
  emitSources();
  log('info', `${idx >= 0 ? 'updated' : 'added'} source ${src.name}`);
  schedule(src.id, 0);
  return src;
});

ipcMain.handle('source:remove', (_e, id) => {
  const state = store.get();
  state.sources = state.sources.filter((s) => s.id !== id);
  delete state.seen[id];
  clearTimeout(timers[id]);
  gens[id] = (gens[id] || 0) + 1;
  delete feeds[id];
  store.save();
  emitSources();
  send('feed:removed', id);
});

ipcMain.handle('source:refresh', (_e, id) => {
  const ids = id ? [id] : store.get().sources.map((s) => s.id);
  ids.forEach((sid, i) => schedule(sid, i * 250));
});

ipcMain.handle('watch:add', (_e, item) => {
  const state = store.get();
  if (state.watch.some((w) => w.key === item.key)) return state.watch;
  const src = findSource(item.sourceId);
  state.watch.unshift({
    key: item.key,
    sourceId: item.sourceId,
    type: src ? src.type : 'rss',
    rawId: item.rawId,
    title: item.title,
    url: item.url,
    discussionUrl: item.discussionUrl,
    addedAt: Date.now(),
    history: [{ t: Date.now(), s: item.score, c: item.comments }],
  });
  store.save();
  emitWatch();
  log('info', `tracking › ${item.title}`);
  return state.watch;
});

ipcMain.handle('watch:remove', (_e, key) => {
  const state = store.get();
  state.watch = state.watch.filter((w) => w.key !== key);
  store.save();
  emitWatch();
  return state.watch;
});

ipcMain.handle('open', (_e, url) => openExternal(url));

// ---- window ----------------------------------------------------------------
function createWindow() {
  win = new BrowserWindow({
    width: 1520,
    height: 940,
    minWidth: 1100,
    minHeight: 680,
    backgroundColor: '#07060d',
    title: 'NEONWIRE',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#07060d', symbolColor: '#00f0ff', height: 44 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Any link that tries to open in-app goes to the system browser instead.
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (DEV_URL && url.startsWith(DEV_URL)) return;
    e.preventDefault();
    openExternal(url);
  });

  if (DEV_URL) win.loadURL(DEV_URL);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.setAppUserModelId('com.neonwire.app');

app.whenReady().then(() => {
  store.get();
  createWindow();
  log('info', `boot :: config at ${store.file()}`);
  store.get().sources.forEach((s, i) => schedule(s.id, 600 + i * 400));
  setTimeout(pollWatch, 5000);
  setInterval(pollWatch, WATCH_POLL_MS);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => store.flush());
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
