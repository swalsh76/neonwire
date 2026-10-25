// Fetchers turn a source config into a list of normalized items:
// { key, rawId, title, url, discussionUrl, author, score, comments, time, summary }
const Parser = require('rss-parser');

const UA = 'neonwire/0.1 (desktop feed monitor)';
const rss = new Parser({ customFields: { item: [['slash:comments', 'slashComments']] } });

async function http(url, as = 'json') {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: as === 'json' ? 'application/json' : '*/*' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return as === 'json' ? res.json() : res.text();
}

const num = (v) => (v === undefined || v === null || v === '' || isNaN(Number(v)) ? null : Number(v));
const toMs = (v) => {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v; // seconds vs ms
  const t = Date.parse(v);
  return isNaN(t) ? null : t;
};
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) =>
  String(s ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
const clean = (s) => decode(s).replace(/\s+/g, ' ').trim();
const snippet = (s) => (s ? clean(s).slice(0, 220) : '');

// Resolve "a.b.0.c" against an object.
function pick(obj, dotted) {
  if (!dotted) return obj;
  return dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// ---- Hacker News (Firebase API) -------------------------------------------
const HN = 'https://hacker-news.firebaseio.com/v0';

function hnItem(it) {
  return {
    key: `hn:${it.id}`,
    rawId: String(it.id),
    title: it.title || '(untitled)',
    url: it.url || `https://news.ycombinator.com/item?id=${it.id}`,
    discussionUrl: `https://news.ycombinator.com/item?id=${it.id}`,
    author: it.by || '',
    score: num(it.score),
    comments: num(it.descendants),
    time: toMs(it.time),
    summary: '',
  };
}

async function fetchHN(src) {
  const ids = (await http(`${HN}/${src.list || 'topstories'}.json`)).slice(0, src.limit || 30);
  const items = await Promise.all(ids.map((id) => http(`${HN}/item/${id}.json`).catch(() => null)));
  return items.filter((it) => it && !it.deleted && !it.dead).map(hnItem);
}

// ---- Reddit (public JSON, falls back to RSS) ------------------------------
function redditItem(d) {
  return {
    key: `reddit:${d.id}`,
    rawId: d.id,
    title: d.title,
    url: d.is_self ? `https://www.reddit.com${d.permalink}` : d.url,
    discussionUrl: `https://www.reddit.com${d.permalink}`,
    author: d.author ? `u/${d.author}` : '',
    score: num(d.score),
    comments: num(d.num_comments),
    time: toMs(d.created_utc),
    summary: snippet(d.selftext),
  };
}

// Reddit frequently 403s anonymous JSON; after a failure, skip straight to RSS for a while.
let redditJsonBlockedUntil = 0;

async function fetchReddit(src) {
  const sub = encodeURIComponent(src.subreddit);
  const sort = src.sort || 'hot';
  try {
    if (Date.now() < redditJsonBlockedUntil) throw new Error('json blocked');
    const json = await http(`https://www.reddit.com/r/${sub}/${sort}.json?limit=40&raw_json=1`);
    return json.data.children.map((c) => c.data).filter((d) => !d.stickied).map(redditItem);
  } catch {
    redditJsonBlockedUntil = Math.max(redditJsonBlockedUntil, Date.now() + 15 * 60_000);
    // Reddit often rejects anonymous JSON requests; RSS still works (no scores though).
    const items = await fetchRSS({ ...src, url: `https://www.reddit.com/r/${sub}/${sort}/.rss` });
    return items.map((it) => {
      const m = /comments\/([a-z0-9]+)/i.exec(it.url || '');
      return m ? { ...it, key: `reddit:${m[1]}`, rawId: m[1], discussionUrl: it.url } : it;
    });
  }
}

async function redditThread(id) {
  if (Date.now() < redditJsonBlockedUntil) return null;
  try {
    const json = await http(`https://www.reddit.com/comments/${id}.json?limit=1&raw_json=1`);
    return redditItem(json[0].data.children[0].data);
  } catch (err) {
    redditJsonBlockedUntil = Date.now() + 15 * 60_000;
    throw err;
  }
}

// ---- RSS / Atom -----------------------------------------------------------
async function fetchRSS(src) {
  const feed = await rss.parseString(await http(src.url, 'text'));
  return feed.items.map((it) => {
    const rawId = it.guid || it.id || it.link || it.title;
    return {
      key: `${src.id}:${rawId}`,
      rawId,
      title: clean(it.title) || '(untitled)',
      url: it.link,
      discussionUrl: it.comments || '',
      author: clean(it.creator || it.author),
      score: null,
      comments: num(it.slashComments),
      time: toMs(it.isoDate || it.pubDate),
      summary: snippet(it.contentSnippet || it.summary),
    };
  });
}

// ---- Generic JSON API (field mapping via dot paths) -----------------------
async function fetchJSON(src) {
  const root = pick(await http(src.url), src.itemsPath);
  if (!Array.isArray(root)) throw new Error(`itemsPath "${src.itemsPath || '(root)'}" is not an array`);
  const f = src.fields || {};
  const field = (row, name) => (f[name] ? pick(row, f[name]) : undefined);
  return root.map((row, i) => {
    const rawId = String(field(row, 'id') ?? field(row, 'url') ?? i);
    const author = field(row, 'author');
    return {
      key: `${src.id}:${rawId}`,
      rawId,
      title: clean(field(row, 'title')) || '(untitled)',
      url: field(row, 'url') || field(row, 'discussionUrl') || '',
      discussionUrl: field(row, 'discussionUrl') || '',
      author: typeof author === 'object' && author ? author.username || author.name || '' : clean(author),
      score: num(field(row, 'score')),
      comments: num(field(row, 'comments')),
      time: toMs(field(row, 'time')),
      summary: snippet(field(row, 'summary')),
    };
  });
}

const FETCHERS = { hn: fetchHN, reddit: fetchReddit, rss: fetchRSS, json: fetchJSON };

async function fetchSource(src) {
  const fn = FETCHERS[src.type];
  if (!fn) throw new Error(`Unknown source type "${src.type}"`);
  return fn(src);
}

// Refresh a single tracked thread directly (only for types with an item API).
async function fetchThread(entry) {
  if (entry.type === 'hn') return hnItem(await http(`${HN}/item/${entry.rawId}.json`));
  if (entry.type === 'reddit') return redditThread(entry.rawId);
  return null;
}

module.exports = { fetchSource, fetchThread };
