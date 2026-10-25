import { NEW_MS } from '../lib/format.js';

const wire = () => window.wire;

function SourceRow({ s, feed, active, now, onSelect, onEdit }) {
  const status = !s.enabled ? 'off' : feed?.status || 'idle';
  const items = feed?.items || [];
  const fresh = items.filter((i) => i.firstSeen && now - i.firstSeen < NEW_MS).length;
  const left = feed?.nextAt ? Math.max(0, feed.nextAt - now) : 0;
  const pct = s.enabled && feed?.nextAt ? Math.min(100, (left / (s.intervalSec * 1000)) * 100) : 0;
  const label =
    status === 'loading' ? 'FETCHING…'
    : status === 'error' ? 'SIGNAL LOST'
    : status === 'off' ? 'OFFLINE'
    : feed?.nextAt ? `T-${Math.ceil(left / 1000)}s`
    : 'STANDBY';
  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div className={`src st-${status} ${active ? 'active' : ''}`} style={{ '--c': s.color }} onClick={() => onSelect(s.id)}>
      <div className="src-row">
        <span className="dot" />
        <span className="src-name">{s.name}</span>
        {fresh > 0 && <span className="new-count">+{fresh}</span>}
        <span className="count">{items.length}</span>
      </div>
      <div className="src-sub">
        <span className="type">{s.type}</span>
        <span className="status">{label}</span>
        <span className="actions">
          <button title="Refresh now" onClick={stop(() => wire().refresh(s.id))}>⟳</button>
          <button title={s.enabled ? 'Disable' : 'Enable'} onClick={stop(() => wire().saveSource({ ...s, enabled: !s.enabled }))}>⏻</button>
          <button title="Edit" onClick={stop(() => onEdit(s))}>✎</button>
          <button title="Remove" onClick={stop(() => window.confirm(`Disconnect ${s.name}?`) && wire().removeSource(s.id))}>✕</button>
        </span>
      </div>
      {status === 'error' && <div className="src-err" title={feed.error}>{feed.error}</div>}
      <div className="bar">
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Sidebar({ sources, feeds, selected, onSelect, onAdd, onEdit, reddit, onReddit, now }) {
  const total = sources.filter((s) => s.enabled).reduce((n, s) => n + (feeds[s.id]?.items?.length || 0), 0);
  return (
    <aside className="panel sidebar">
      <header className="ph">
        <span>
          SOURCES <b>[{sources.length}]</b>
        </span>
        <button className="btn xs" onClick={onAdd}>
          + JACK IN
        </button>
      </header>
      <div className="scroll">
        <div className={`src all ${!selected ? 'active' : ''}`} style={{ '--c': '#ffffff' }} onClick={() => onSelect(null)}>
          <div className="src-row">
            <span className="dot" />
            <span className="src-name">ALL FEEDS</span>
            <span className="count">{total}</span>
          </div>
        </div>
        {sources.map((s) => (
          <SourceRow
            key={s.id}
            s={s}
            feed={feeds[s.id]}
            active={selected === s.id}
            now={now}
            onSelect={onSelect}
            onEdit={onEdit}
          />
        ))}
      </div>
      <footer className="side-foot">
        <button className={`uplink ${reddit.loggedIn ? 'on' : ''}`} onClick={onReddit} title="Reddit account">
          <span className="dot" />
          <span className="uplink-name">REDDIT</span>
          <span className="uplink-state">
            {reddit.pending ? 'LINKING…' : reddit.loggedIn ? `u/${reddit.username}` : 'ANONYMOUS · LOG IN'}
          </span>
        </button>
      </footer>
    </aside>
  );
}
