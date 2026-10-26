import { useEffect, useState } from 'react';
import { BLANK, HN_LISTS, JSON_FIELDS, PALETTE, PRESETS, REDDIT_SORTS, TYPES } from '../lib/presets.js';
import { ipcError } from '../lib/format.js';
import PanelHead from './PanelHead.jsx';

function Field({ label, children, wide }) {
  return (
    <label className={`field ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function SourceModal({ initial, sources, onClose }) {
  const isEdit = !!initial.id;
  const [form, setForm] = useState(() => {
    if (isEdit) return structuredClone(initial);
    const used = new Set(sources.map((s) => s.color));
    const color = PALETTE.find((c) => !used.has(c)) || PALETTE[sources.length % PALETTE.length];
    return { type: 'rss', name: '', color, enabled: true, notify: false, ...BLANK.rss };
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setField = (k, v) => setForm((f) => ({ ...f, fields: { ...f.fields, [k]: v } }));
  const keep = (f) => ({ id: f.id, name: f.name, color: f.color, enabled: f.enabled, notify: f.notify });
  const setType = (type) => setForm((f) => ({ ...keep(f), type, ...structuredClone(BLANK[type]) }));
  const applyPreset = (p) => setForm((f) => ({ ...keep(f), ...structuredClone(p.src) }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await window.wire.saveSource(form);
      onClose();
    } catch (err) {
      setError(ipcError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="panel modal" onSubmit={submit} style={{ '--c': form.color }}>
        <PanelHead idx="+" title={isEdit ? 'RECONFIGURE NODE' : 'NEW SOURCE'} jp={isEdit ? '設定' : '接続'}>
          <button type="button" className="x" onClick={onClose}>
            ✕
          </button>
        </PanelHead>

        <div className="modal-body">
          {!isEdit && (
            <>
              <div className="lbl">QUICK PRESETS</div>
              <div className="presets">
                {PRESETS.map((p) => (
                  <button type="button" key={p.label} className="preset" onClick={() => applyPreset(p)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="lbl">PROTOCOL</div>
          <div className="seg wide">
            {Object.entries(TYPES).map(([k, label]) => (
              <button type="button" key={k} className={form.type === k ? 'on' : ''} onClick={() => setType(k)}>
                {label}
              </button>
            ))}
          </div>

          <div className="grid">
            <Field label="NAME">
              <input value={form.name} placeholder="auto" onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="POLL EVERY (SEC)">
              <input type="number" min={30} value={form.intervalSec} onChange={(e) => set('intervalSec', Number(e.target.value))} />
            </Field>

            {form.type === 'rss' && (
              <Field label="FEED URL" wide>
                <input required type="url" value={form.url} placeholder="https://example.com/feed.xml" onChange={(e) => set('url', e.target.value)} />
              </Field>
            )}

            {form.type === 'hn' && (
              <>
                <Field label="LIST">
                  <select value={form.list} onChange={(e) => set('list', e.target.value)}>
                    {HN_LISTS.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </Field>
                <Field label="ITEMS">
                  <input type="number" min={5} max={100} value={form.limit} onChange={(e) => set('limit', Number(e.target.value))} />
                </Field>
              </>
            )}

            {form.type === 'reddit' && (
              <>
                <Field label="SUBREDDIT (BLANK = YOUR FRONT PAGE, NEEDS LOGIN)">
                  <input value={form.subreddit} placeholder="programming" onChange={(e) => set('subreddit', e.target.value.replace(/^\/?r\//, ''))} />
                </Field>
                <Field label="SORT">
                  <select value={form.sort} onChange={(e) => set('sort', e.target.value)}>
                    {REDDIT_SORTS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
              </>
            )}

            {form.type === 'fourchan' && (
              <>
                <Field label="BOARD">
                  <input required value={form.board} placeholder="g" onChange={(e) => set('board', e.target.value.replace(/\//g, ''))} />
                </Field>
                <Field label="THREADS (BUMP ORDER)">
                  <input type="number" min={5} max={150} value={form.limit} onChange={(e) => set('limit', Number(e.target.value))} />
                </Field>
              </>
            )}

            {form.type === 'json' && (
              <>
                <Field label="ENDPOINT URL" wide>
                  <input required type="url" value={form.url} placeholder="https://api.example.com/items" onChange={(e) => set('url', e.target.value)} />
                </Field>
                <Field label="ITEMS PATH (dot path to the array, blank = root)" wide>
                  <input value={form.itemsPath} placeholder="data.children" onChange={(e) => set('itemsPath', e.target.value)} />
                </Field>
                {JSON_FIELDS.map((k) => (
                  <Field key={k} label={`FIELD › ${k}`}>
                    <input value={form.fields?.[k] || ''} placeholder="—" onChange={(e) => setField(k, e.target.value)} />
                  </Field>
                ))}
              </>
            )}
          </div>

          <div className="lbl">SIGNAL COLOR</div>
          <div className="swatches">
            {PALETTE.map((c) => (
              <button type="button" key={c} className={form.color === c ? 'on' : ''} style={{ '--c': c }} onClick={() => set('color', c)} />
            ))}
            <input type="color" value={form.color} onChange={(e) => set('color', e.target.value)} />
          </div>

          <label className="check">
            <input type="checkbox" checked={form.notify} onChange={(e) => set('notify', e.target.checked)} />
            DESKTOP NOTIFICATION ON NEW ITEMS
          </label>

          {error && <div className="form-err">⚠ {error}</div>}
        </div>

        <footer className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            CANCEL
          </button>
          <button className="btn solid" disabled={busy}>
            {isEdit ? 'SAVE' : 'CONNECT'}
          </button>
        </footer>
      </form>
    </div>
  );
}
