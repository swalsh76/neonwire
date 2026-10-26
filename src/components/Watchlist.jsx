import PanelHead from './PanelHead.jsx';
import RingMark from './RingMark.jsx';
import Sparkline from './Sparkline.jsx';
import { ago, compact, delta } from '../lib/format.js';

const HOUR = 3.6e6;
const diff = (a, b) => (a === null || a === undefined || b === null || b === undefined ? null : a - b);

function Stat({ label, value, total, hour, cls }) {
  return (
    <div className={`stat ${cls}`}>
      <small>{label}</small>
      <b>{compact(value)}</b>
      <span className={hour > 0 ? 'up' : ''}>
        {delta(total)} · {delta(hour)}/1h
      </span>
    </div>
  );
}

function WatchCard({ w, color, now }) {
  const h = w.history;
  const first = h[0] || {};
  const last = h[h.length - 1] || {};
  // Most recent sample at least an hour old (or the first one if we're younger than that).
  const hourAgo = [...h].reverse().find((p) => now - p.t >= HOUR) || first;

  return (
    <div className="watch" style={{ '--c': color }}>
      <div className="watch-head">
        <a className="watch-title" onClick={() => window.wire.open(w.discussionUrl || w.url)}>
          {w.title}
        </a>
        <button className="x" title="Stop tracking" onClick={() => window.wire.unwatch(w.key)}>
          ✕
        </button>
      </div>
      <Sparkline points={h} />
      <div className="watch-stats">
        <Stat label="SCORE" cls="s" value={last.s} total={diff(last.s, first.s)} hour={diff(last.s, hourAgo.s)} />
        <Stat label="REPLIES" cls="c" value={last.c} total={diff(last.c, first.c)} hour={diff(last.c, hourAgo.c)} />
      </div>
      <div className="watch-foot">
        tracking {ago(w.addedAt, now)} · {h.length} samples · last {ago(last.t, now)} ago
      </div>
    </div>
  );
}

export default function Watchlist({ watch, sources, now }) {
  const colorOf = (id) => sources.find((s) => s.id === id)?.color || '#00f0ff';
  return (
    <aside className="panel watchlist">
      <PanelHead idx="03" title="TRACKING" jp="追跡" count={watch.length}>
        <span className="legend">
          <i className="lg-s" /> SCORE <i className="lg-c" /> REPLIES
        </span>
      </PanelHead>
      <div className="scroll">
        {watch.length === 0 && (
          <div className="empty">
            <RingMark spin />
            NO TARGETS
            <small>Hit [ TRACK ] on any item to log its score &amp; reply velocity over time.</small>
          </div>
        )}
        {watch.map((w) => (
          <WatchCard key={w.key} w={w} color={colorOf(w.sourceId)} now={now} />
        ))}
      </div>
    </aside>
  );
}
