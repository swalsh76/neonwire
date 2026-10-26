import PanelHead from './PanelHead.jsx';
import RingMark from './RingMark.jsx';
import { FLASH_MS, NEW_MS, ago, compact, host, velocity } from '../lib/format.js';

const SORTS = [
  ['latest', 'LATEST'],
  ['hot', 'HOT'],
  ['top', 'TOP'],
  ['fresh', 'ARRIVALS'],
];
const MAX_CARDS = 400;

function Card({ it, now, watched }) {
  const isNew = it.firstSeen > 0 && now - it.firstSeen < NEW_MS;
  const flash = it.firstSeen > 0 && now - it.firstSeen < FLASH_MS;
  const vel = velocity(it, now);
  const site = host(it.url);
  const { source, ...item } = it;

  return (
    <article className="card" style={{ '--c': source.color }} data-new={isNew || undefined} data-flash={flash || undefined}>
      <div className="card-top">
        <span className="tag">{source.name}</span>
        {site && <span className="host">{site}</span>}
        <span className="age">{ago(it.time || it.firstSeen, now)} ago</span>
        {isNew && <span className="new">NEW</span>}
      </div>
      <h3>
        <a onClick={() => window.wire.open(it.url)}>{it.title}</a>
      </h3>
      {it.summary && <p className="summary">{it.summary}</p>}
      <div className="card-stats">
        {it.score != null && <span className="score">▲ {compact(it.score)}</span>}
        {it.comments != null && <span className="comments">◆ {compact(it.comments)}</span>}
        {vel != null && <span className={`vel ${vel > 40 ? 'hot' : ''}`}>⚡ {vel.toFixed(vel < 10 ? 1 : 0)}/h</span>}
        {it.author && <span className="author">{it.author}</span>}
        <span className="spacer" />
        {it.discussionUrl && it.discussionUrl !== it.url && (
          <button className="btn xs ghost" onClick={() => window.wire.open(it.discussionUrl)}>
            THREAD
          </button>
        )}
        <button
          className={`btn xs ${watched ? 'on' : 'ghost'}`}
          onClick={() => (watched ? window.wire.unwatch(it.key) : window.wire.watch(item))}
        >
          {watched ? 'TRACKING' : 'TRACK'}
        </button>
      </div>
    </article>
  );
}

export default function Stream({ items, title, now, watchKeys, sort, setSort }) {
  return (
    <main className="panel stream">
      <PanelHead idx="02" title={`LIVE STREAM // ${title}`} jp="ストリーム" count={items.length}>
        <div className="seg">
          {SORTS.map(([key, label]) => (
            <button key={key} className={sort === key ? 'on' : ''} onClick={() => setSort(key)}>
              {label}
            </button>
          ))}
        </div>
      </PanelHead>
      <div className="scroll cards">
        {items.length === 0 ? (
          <div className="empty">
            <RingMark spin />
            STANDBY
            <small>waiting for feeds to sync…</small>
          </div>
        ) : (
          items.slice(0, MAX_CARDS).map((it) => <Card key={it.key} it={it} now={now} watched={watchKeys.has(it.key)} />)
        )}
      </div>
    </main>
  );
}
