export const TYPES = { rss: 'RSS / ATOM', hn: 'HACKER NEWS', reddit: 'REDDIT', fourchan: '4CHAN', json: 'JSON API' };

export const PALETTE = ['#00f0ff', '#ff2bd6', '#f9f002', '#39ff14', '#ff8a00', '#b967ff', '#ff3860', '#05ffa1'];

export const HN_LISTS = ['topstories', 'newstories', 'beststories', 'showstories', 'askstories'];
export const REDDIT_SORTS = ['hot', 'new', 'rising', 'top', 'best'];

export const JSON_FIELDS = ['id', 'title', 'url', 'discussionUrl', 'score', 'comments', 'time', 'author', 'summary'];

const LOBSTERS_FIELDS = { id: 'short_id', title: 'title', url: 'url', discussionUrl: 'comments_url', score: 'score', comments: 'comment_count', time: 'created_at', author: 'submitter_user' };

export const BLANK = {
  rss: { url: '', intervalSec: 300 },
  hn: { list: 'topstories', limit: 30, intervalSec: 60 },
  reddit: { subreddit: '', sort: 'hot', intervalSec: 120 },
  fourchan: { board: '', limit: 40, intervalSec: 120 },
  json: { url: '', itemsPath: '', fields: { id: 'id', title: 'title', url: 'url' }, intervalSec: 180 },
};

export const PRESETS = [
  { label: 'HN // New', src: { type: 'hn', name: 'Hacker News // New', list: 'newstories', limit: 30, intervalSec: 60 } },
  { label: 'HN // Best', src: { type: 'hn', name: 'Hacker News // Best', list: 'beststories', limit: 30, intervalSec: 120 } },
  { label: 'HN // Show', src: { type: 'hn', name: 'Show HN', list: 'showstories', limit: 30, intervalSec: 120 } },
  { label: 'HN // Ask', src: { type: 'hn', name: 'Ask HN', list: 'askstories', limit: 30, intervalSec: 120 } },
  { label: 'Reddit // My front page (login)', src: { type: 'reddit', name: 'Reddit // Front page', subreddit: '', sort: 'best', intervalSec: 120 } },
  { label: 'r/technology', src: { type: 'reddit', name: 'r/technology', subreddit: 'technology', sort: 'hot', intervalSec: 120 } },
  { label: 'r/worldnews', src: { type: 'reddit', name: 'r/worldnews', subreddit: 'worldnews', sort: 'hot', intervalSec: 120 } },
  { label: 'r/cyberpunk', src: { type: 'reddit', name: 'r/cyberpunk', subreddit: 'Cyberpunk', sort: 'hot', intervalSec: 300 } },
  { label: 'Lobsters // Newest', src: { type: 'json', name: 'Lobsters // Newest', url: 'https://lobste.rs/newest.json', itemsPath: '', fields: LOBSTERS_FIELDS, intervalSec: 180 } },
  { label: 'DEV // Top', src: { type: 'json', name: 'DEV // Top', url: 'https://dev.to/api/articles?top=1&per_page=30', itemsPath: '', fields: { id: 'id', title: 'title', url: 'url', score: 'positive_reactions_count', comments: 'comments_count', time: 'published_at', author: 'user.username', summary: 'description' }, intervalSec: 600 } },
  { label: 'Slashdot', src: { type: 'rss', name: 'Slashdot', url: 'https://rss.slashdot.org/Slashdot/slashdotMain', intervalSec: 300 } },
  { label: 'TechCrunch', src: { type: 'rss', name: 'TechCrunch', url: 'https://techcrunch.com/feed/', intervalSec: 300 } },
  { label: 'Wired', src: { type: 'rss', name: 'Wired', url: 'https://www.wired.com/feed/rss', intervalSec: 600 } },
  { label: 'BBC // World', src: { type: 'rss', name: 'BBC // World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', intervalSec: 300 } },
  { label: 'GitHub releases (electron)', src: { type: 'rss', name: 'electron releases', url: 'https://github.com/electron/electron/releases.atom', intervalSec: 900 } },
];
