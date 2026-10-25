import { useEffect, useRef } from 'react';
import { clock } from '../lib/format.js';

export default function Console({ logs, ticker }) {
  const logRef = useRef(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <section className="panel console">
      <div className="ticker">
        <span className="ticker-label">◢ NEWSWIRE</span>
        <div className="ticker-window">
          <div className="ticker-track" style={{ animationDuration: `${Math.max(40, ticker.length * 7)}s` }}>
            {[...ticker, ...ticker].map((it, i) => (
              <span key={i} style={{ '--c': it.source.color }} onClick={() => window.wire.open(it.url)}>
                {it.title}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="log" ref={logRef}>
        {logs.map((l, i) => (
          <div key={i} className={`l-${l.level}`}>
            <time>[{clock(l.t)}]</time>
            <span className="lvl">{l.level.toUpperCase()}</span>
            {l.msg}
          </div>
        ))}
        <div className="prompt">
          &gt; awaiting signal<span className="cursor">_</span>
        </div>
      </div>
    </section>
  );
}
