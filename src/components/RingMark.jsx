// Broken concentric-ring emblem (cyberbrain / "ONLINE" ring motif). Drawn in currentColor.
export default function RingMark({ className = '', spin = false }) {
  return (
    <svg className={`ringmark ${spin ? 'spin' : ''} ${className}`} viewBox="0 0 100 100" aria-hidden="true">
      <g className="rm-outer">
        <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray="78 7 46 7 104 10 24 0" />
        <rect x="47" y="1" width="6" height="9" fill="currentColor" />
        <rect x="88" y="47" width="10" height="6" fill="currentColor" transform="rotate(32 93 50)" />
        <rect x="5" y="58" width="10" height="6" fill="currentColor" transform="rotate(-18 10 61)" />
      </g>
      <g className="rm-mid">
        <circle cx="50" cy="50" r="32" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray="110 9 52 12 18 0" opacity="0.85" />
      </g>
      <circle cx="50" cy="50" r="19" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.7" />
      <path d="M50 44v12M44 50h12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
