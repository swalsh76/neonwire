// Tiny JSON-file persistence in the app's userData folder (debounced writes).
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULT_STATE = {
  sources: [
    { id: 'hn-top', type: 'hn', name: 'Hacker News // Top', list: 'topstories', limit: 30, intervalSec: 60, color: '#ffb347', enabled: true, notify: false },
    { id: 'lobsters', type: 'json', name: 'Lobsters // Hottest', url: 'https://lobste.rs/hottest.json', itemsPath: '', fields: { id: 'short_id', title: 'title', url: 'url', discussionUrl: 'comments_url', score: 'score', comments: 'comment_count', time: 'created_at', author: 'submitter_user' }, intervalSec: 180, color: '#ff7a5c', enabled: true, notify: false },
    { id: 'r-programming', type: 'reddit', name: 'r/programming', subreddit: 'programming', sort: 'hot', intervalSec: 120, color: '#2fe0b0', enabled: true, notify: false },
    { id: 'ars', type: 'rss', name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', intervalSec: 300, color: '#5cd6ff', enabled: true, notify: false },
    { id: 'verge', type: 'rss', name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', intervalSec: 300, color: '#7fa8ff', enabled: true, notify: false },
  ],
  watch: [], // tracked threads: { key, sourceId, type, rawId, title, url, discussionUrl, addedAt, history: [{ t, s, c }] }
  seen: {}, // sourceId -> { itemKey: firstSeenTimestamp }
};

// v0.3 neon palette → current palette, so existing sources pick up the new theme.
const LEGACY_COLORS = {
  '#00f0ff': '#5cd6ff',
  '#ff2bd6': '#ff7a5c',
  '#f9f002': '#7fa8ff',
  '#39ff14': '#2fe0b0',
  '#ff8a00': '#ffb347',
  '#b967ff': '#c3a6ff',
  '#ff3860': '#ff7a5c',
  '#05ffa1': '#46ff8c',
  '#5dff8f': '#46ff8c',
};

let state = null;
let writeTimer = null;

const file = () => path.join(app.getPath('userData'), 'neonwire.json');

function load() {
  try {
    state = { ...structuredClone(DEFAULT_STATE), ...JSON.parse(fs.readFileSync(file(), 'utf8')) };
  } catch {
    state = structuredClone(DEFAULT_STATE);
  }
  for (const s of state.sources) s.color = LEGACY_COLORS[s.color?.toLowerCase()] || s.color;
  return state;
}

function get() {
  return state || load();
}

function save() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(flush, 500);
}

function flush() {
  clearTimeout(writeTimer);
  if (!state) return;
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(state, null, 2));
}

module.exports = { get, save, flush, file };
