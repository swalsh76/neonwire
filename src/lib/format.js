export const NEW_MS = 15 * 60_000; // items first seen within this window get the NEW badge
export const FLASH_MS = 8_000; // ...and within this one, the arrival animation

export function ago(t, now = Date.now()) {
  if (!t) return '—';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export function compact(n) {
  if (n === null || n === undefined) return '—';
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 1000)}k`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function delta(n) {
  if (n === null || n === undefined) return '—';
  return n > 0 ? `+${compact(n)}` : n < 0 ? `−${compact(-n)}` : '±0';
}

// Strip Electron's "Error invoking remote method 'x': Error: " wrapper from IPC errors.
export const ipcError = (err) => String(err?.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

export const clock =(t) => new Date(t).toLocaleTimeString([], { hour12: false });

export function host(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// Points per hour since posting — a cheap "how hot is this right now" signal.
export function velocity(item, now) {
  if (item.score === null || item.score === undefined || !item.time) return null;
  return item.score / Math.max((now - item.time) / 3.6e6, 0.5);
}
