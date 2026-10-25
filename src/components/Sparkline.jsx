import { useId } from 'react';

const W = 300;

// Score (filled) and comments (line) over time, each scaled to its own range.
export default function Sparkline({ points, height = 48 }) {
  const gid = useId().replace(/:/g, '');
  if (points.length < 2) {
    return (
      <div className="spark spark-empty" style={{ height }}>
        COLLECTING DATA…
      </div>
    );
  }

  const H = height;
  const t0 = points[0].t;
  const span = points[points.length - 1].t - t0 || 1;
  const series = (key) => {
    const pts = points.filter((p) => p[key] !== null && p[key] !== undefined);
    if (pts.length < 2) return null;
    const vals = pts.map((p) => p[key]);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return pts
      .map((p, i) => {
        const x = ((p.t - t0) / span) * W;
        const y = max === min ? H / 2 : H - 3 - ((p[key] - min) / (max - min)) * (H - 6);
        return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join('');
  };
  const s = series('s');
  const c = series('c');

  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: 'var(--c)', stopOpacity: 0.45 }} />
          <stop offset="100%" style={{ stopColor: 'var(--c)', stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      {s && <path d={`${s}L${W},${H}L0,${H}Z`} fill={`url(#${gid})`} />}
      {s && <path d={s} className="sl-s" />}
      {c && <path d={c} className="sl-c" />}
    </svg>
  );
}
