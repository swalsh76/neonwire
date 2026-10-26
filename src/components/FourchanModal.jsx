import { useEffect, useMemo, useState } from 'react';
import { PALETTE } from '../lib/presets.js';
import { ipcError } from '../lib/format.js';
import PanelHead from './PanelHead.jsx';

// Board picker: each checked board is a 'fourchan' source; applying adds/removes sources to match.
export default function FourchanModal({ sources, onClose }) {
  const subscribed = useMemo(
    () => new Map(sources.filter((s) => s.type === 'fourchan').map((s) => [s.board, s])),
    [sources],
  );
  const [boards, setBoards] = useState(null);
  const [checked, setChecked] = useState(() => new Set(subscribed.keys()));
  const [filter, setFilter] = useState('');
  const [showNsfw, setShowNsfw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.wire
      .fourchanBoards()
      .then((list) => {
        setBoards(list);
        if (list.some((b) => b.nsfw && subscribed.has(b.board))) setShowNsfw(true);
      })
      .catch((err) => setError(`Couldn't load the board list: ${ipcError(err)}`));
  }, []); // load once; `subscribed` only seeds the NSFW toggle

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = (board) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(board)) next.delete(board);
      else next.add(board);
      return next;
    });

  const q = filter.trim().toLowerCase().replace(/\//g, '');
  const visible = (boards || []).filter((b) => !q || b.board.includes(q) || b.title.toLowerCase().includes(q));
  const groups = [['WORKSAFE', visible.filter((b) => !b.nsfw)], ...(showNsfw ? [['NSFW', visible.filter((b) => b.nsfw)]] : [])];

  const added = [...checked].filter((b) => !subscribed.has(b));
  const removed = [...subscribed.keys()].filter((b) => !checked.has(b));

  async function apply() {
    setBusy(true);
    setError('');
    try {
      const used = new Set(sources.map((s) => s.color));
      const titleOf = Object.fromEntries((boards || []).map((b) => [b.board, b.title]));
      for (const [i, board] of added.entries()) {
        const color = PALETTE.find((c) => !used.has(c)) || PALETTE[(sources.length + i) % PALETTE.length];
        used.add(color);
        await window.wire.saveSource({
          type: 'fourchan',
          board,
          name: `/${board}/ - ${titleOf[board] || board}`,
          limit: 40,
          intervalSec: 120,
          color,
          enabled: true,
          notify: false,
        });
      }
      for (const board of removed) await window.wire.removeSource(subscribed.get(board).id);
      onClose();
    } catch (err) {
      setError(ipcError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel modal chan-modal">
        <PanelHead idx="+" title="UPLINK // 4CHAN" jp="掲示板" count={checked.size}>
          <button type="button" className="x" onClick={onClose}>
            ✕
          </button>
        </PanelHead>

        <div className="modal-body">
          <p className="lead">
            Check the boards to subscribe to. Each board polls its catalog every 2 minutes. The stream shows thread
            names only: no images and no post text.
          </p>
          <div className="chan-tools">
            <input placeholder="FILTER BOARDS…  e.g. g, tech, /v/" value={filter} onChange={(e) => setFilter(e.target.value)} autoFocus />
            <label className="check">
              <input type="checkbox" checked={showNsfw} onChange={(e) => setShowNsfw(e.target.checked)} />
              SHOW NSFW BOARDS
            </label>
          </div>

          {!boards && !error && (
            <div className="handshake">
              <span className="spinner" /> FETCHING BOARD LIST…
            </div>
          )}

          {groups.map(
            ([label, list]) =>
              list.length > 0 && (
                <section key={label}>
                  <div className="lbl">
                    {label} <span className="lbl-count">{list.length}</span>
                  </div>
                  <div className="board-grid">
                    {list.map((b) => (
                      <label key={b.board} className={`board ${checked.has(b.board) ? 'on' : ''} ${b.nsfw ? 'nsfw' : ''}`}>
                        <input type="checkbox" checked={checked.has(b.board)} onChange={() => toggle(b.board)} />
                        <span className="board-id">/{b.board}/</span>
                        <span className="board-title">{b.title}</span>
                      </label>
                    ))}
                  </div>
                </section>
              ),
          )}
          {boards && visible.length === 0 && <div className="lbl">NO BOARDS MATCH “{filter}”</div>}
          {error && <div className="form-err">⚠ {error}</div>}
        </div>

        <footer className="modal-foot">
          <span className="diff">
            {added.length > 0 && <span className="plus">+{added.length} SUBSCRIBE</span>}
            {removed.length > 0 && <span className="minus">−{removed.length} UNSUBSCRIBE</span>}
          </span>
          <button type="button" className="btn ghost" onClick={onClose}>
            CANCEL
          </button>
          <button type="button" className="btn solid" disabled={busy || (!added.length && !removed.length)} onClick={apply}>
            {busy ? 'APPLYING…' : 'APPLY'}
          </button>
        </footer>
      </div>
    </div>
  );
}
