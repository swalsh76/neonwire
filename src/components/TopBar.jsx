import { useEffect, useRef } from 'react';
import { clock } from '../lib/format.js';

function Chip({ label, value, tone }) {
  return (
    <div className={`chip ${tone || ''}`}>
      <small>{label}</small>
      <b>{value}</b>
    </div>
  );
}

export default function TopBar({ stats, query, setQuery, now }) {
  const search = useRef(null);

  // "/" or Ctrl+F jumps to search, Esc clears it.
  useEffect(() => {
    const onKey = (e) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      if ((e.key === '/' && !typing) || (e.key === 'f' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        search.current?.focus();
      } else if (e.key === 'Escape' && document.activeElement === search.current) {
        setQuery('');
        search.current.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setQuery]);

  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo" data-text="NEONWIRE">NEONWIRE</span>
        <span className="slash">//</span>
        <span className="sub">SIGNAL MONITOR</span>
      </div>
      <div className="chips">
        <Chip label="NODES" value={`${stats.online}/${stats.total}`} tone={stats.errors ? 'warn' : 'ok'} />
        <Chip label="ITEMS" value={stats.items} />
        <Chip label="NEW" value={stats.fresh} tone={stats.fresh ? 'hot' : ''} />
        <Chip label="TRACKING" value={stats.tracking} />
      </div>
      <div className="search-wrap">
        <span className="search-icon">⌕</span>
        <input
          ref={search}
          className="search"
          placeholder="SEARCH THE WIRE…  [/]"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <button className="btn" onClick={() => window.wire.refresh()}>
        ⟳ SYNC ALL
      </button>
      <div className="clock">{clock(now)}</div>
    </header>
  );
}
