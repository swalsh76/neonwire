import { useEffect, useMemo, useState } from 'react';
import TopBar from './components/TopBar.jsx';
import Sidebar from './components/Sidebar.jsx';
import Stream from './components/Stream.jsx';
import Watchlist from './components/Watchlist.jsx';
import Console from './components/Console.jsx';
import SourceModal from './components/SourceModal.jsx';
import RedditModal from './components/RedditModal.jsx';
import { NEW_MS, velocity } from './lib/format.js';

function useNow(ms) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const SORTERS = {
  latest: (a, b) => (b.time || b.firstSeen) - (a.time || a.firstSeen),
  hot: (a, b, now) => (velocity(b, now) ?? -1) - (velocity(a, now) ?? -1),
  top: (a, b) => (b.score ?? -1) - (a.score ?? -1),
  fresh: (a, b) => b.firstSeen - a.firstSeen || SORTERS.latest(a, b),
};

export default function App() {
  const [sources, setSources] = useState([]);
  const [feeds, setFeeds] = useState({});
  const [watch, setWatch] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('latest');
  const [editing, setEditing] = useState(null); // null = closed, {} = new source, src = edit
  const [reddit, setReddit] = useState({ loggedIn: false, pending: false, clientId: '', username: '', redirectUri: '' });
  const [showReddit, setShowReddit] = useState(false);
  const now = useNow(1000);
  const minute = Math.floor(now / 60_000) * 60_000; // re-sort at most once a minute

  useEffect(() => {
    const w = window.wire;
    if (!w) return;
    w.getState().then((s) => {
      setSources(s.sources);
      setFeeds(s.feeds);
      setWatch(s.watch);
      setLogs(s.logs);
      setReddit(s.reddit);
    });
    const offs = [
      w.onFeed((f) => setFeeds((prev) => ({ ...prev, [f.id]: f }))),
      w.onFeedRemoved((id) =>
        setFeeds((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        }),
      ),
      w.onSources(setSources),
      w.onWatch(setWatch),
      w.onReddit(setReddit),
      w.onLog((e) => setLogs((prev) => [...prev.slice(-199), e])),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  useEffect(() => {
    if (selected && !sources.some((s) => s.id === selected)) setSelected(null);
  }, [sources, selected]);

  // Every enabled source's items, deduped by key (the same HN story can be in Top and Best).
  const allItems = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const s of sources) {
      if (!s.enabled) continue;
      for (const it of feeds[s.id]?.items || []) {
        if (seen.has(it.key)) continue;
        seen.add(it.key);
        out.push({ ...it, source: s });
      }
    }
    return out;
  }, [sources, feeds]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allItems
      .filter((it) => !selected || it.sourceId === selected)
      .filter((it) => !q || `${it.title} ${it.author} ${it.url} ${it.summary}`.toLowerCase().includes(q))
      .sort((a, b) => SORTERS[sort](a, b, minute));
  }, [allItems, selected, query, sort, minute]);

  const ticker = useMemo(
    () => [...allItems].sort((a, b) => SORTERS.fresh(a, b)).slice(0, 16),
    [allItems],
  );

  const stats = useMemo(() => {
    const enabled = sources.filter((s) => s.enabled);
    return {
      total: enabled.length,
      online: enabled.filter((s) => feeds[s.id]?.status === 'ok' || feeds[s.id]?.status === 'loading').length,
      errors: enabled.filter((s) => feeds[s.id]?.status === 'error').length,
      items: allItems.length,
      fresh: allItems.filter((it) => it.firstSeen && now - it.firstSeen < NEW_MS).length,
      tracking: watch.length,
    };
  }, [sources, feeds, allItems, watch, now]);

  if (!window.wire) {
    return <div className="no-bridge">NEONWIRE must run inside Electron — use <code>npm run dev</code>.</div>;
  }

  const watchKeys = new Set(watch.map((w) => w.key));
  const selectedName = sources.find((s) => s.id === selected)?.name || 'ALL FEEDS';

  return (
    <div className="app">
      <TopBar stats={stats} query={query} setQuery={setQuery} now={now} />
      <Sidebar
        sources={sources}
        feeds={feeds}
        selected={selected}
        onSelect={setSelected}
        onAdd={() => setEditing({})}
        onEdit={setEditing}
        reddit={reddit}
        onReddit={() => setShowReddit(true)}
        now={now}
      />
      <Stream items={items} title={selectedName} now={now} watchKeys={watchKeys} sort={sort} setSort={setSort} />
      <Watchlist watch={watch} sources={sources} now={now} />
      <Console logs={logs} ticker={ticker} />
      {editing && <SourceModal initial={editing} sources={sources} onClose={() => setEditing(null)} />}
      {showReddit && <RedditModal status={reddit} onClose={() => setShowReddit(false)} />}
    </div>
  );
}
