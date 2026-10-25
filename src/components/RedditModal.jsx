import { useEffect, useState } from 'react';
import { ipcError } from '../lib/format.js';

const APPS_URL = 'https://www.reddit.com/prefs/apps';
const REDDITDEV_URL = 'https://www.reddit.com/r/redditdev/';

export default function RedditModal({ status, onClose }) {
  const [clientId, setClientId] = useState(status.clientId);
  const [secret, setSecret] = useState(undefined); // undefined = keep whatever is saved
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function login(e) {
    e.preventDefault();
    setError('');
    try {
      await window.wire.redditLogin({ clientId, clientSecret: secret });
      setSecret(undefined);
    } catch (err) {
      setError(ipcError(err));
    }
  }

  async function logout() {
    setError('');
    await window.wire.redditLogout();
  }

  async function copyRedirect() {
    try {
      await navigator.clipboard.writeText(status.redirectUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError(`Copy failed — the redirect URI is ${status.redirectUri}`);
    }
  }

  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="panel modal reddit-modal" onSubmit={login} style={{ '--c': '#ff4500' }}>
        <header className="ph">
          <span>UPLINK // REDDIT</span>
          <button type="button" className="x" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="modal-body">
          {status.loggedIn ? (
            <div className="connected">
              <div className="conn-label">LINK ACTIVE</div>
              <div className="conn-user">u/{status.username || 'unknown'}</div>
              <p>
                Reddit sources now use the official API: live scores, comment counts and thread tracking. Add a Reddit
                source with a blank subreddit to stream your personal front page.
              </p>
            </div>
          ) : (
            <>
              <p className="lead">
                Without a login NEONWIRE falls back to Reddit's RSS feeds: headlines only, with no scores or comment
                counts. Log in to get the full data.
              </p>
              <ol className="steps">
                <li>
                  Create an app at <a onClick={() => window.wire.open(APPS_URL)}>reddit.com/prefs/apps</a>. Choose type{' '}
                  <b>installed app</b>.
                </li>
                <li>
                  Set its redirect URI to:
                  <span className="copy-row">
                    <code>{status.redirectUri}</code>
                    <button type="button" className="btn xs ghost" onClick={copyRedirect}>
                      {copied ? 'COPIED' : 'COPY'}
                    </button>
                  </span>
                </li>
                <li>Paste the client ID (the string under the app name) below and log in. Your browser will open.</li>
              </ol>
              <p className="note">
                ⚠ Since Nov 2025, Reddit requires approval for new API apps under its Responsible Builder Policy (see{' '}
                <a onClick={() => window.wire.open(REDDITDEV_URL)}>r/redditdev</a>). Apps created before that keep
                working.
              </p>

              <div className="grid">
                <label className="field wide">
                  <span>CLIENT ID</span>
                  <input required value={clientId} placeholder="e.g. p-jcoLKBynTLew" onChange={(e) => setClientId(e.target.value)} disabled={status.pending} />
                </label>
                <label className="field wide">
                  <span>CLIENT SECRET (ONLY FOR "WEB APP" / "SCRIPT" TYPES)</span>
                  <input
                    type="password"
                    value={secret ?? ''}
                    placeholder={status.hasSecret ? '•••••••• saved — type to replace' : 'leave blank for installed apps'}
                    onChange={(e) => setSecret(e.target.value)}
                    disabled={status.pending}
                  />
                </label>
              </div>
            </>
          )}

          {status.pending && (
            <div className="handshake">
              <span className="spinner" /> AWAITING BROWSER HANDSHAKE… approve NEONWIRE in the Reddit tab that just opened.
            </div>
          )}
          {error && <div className="form-err">⚠ {error}</div>}
        </div>

        <footer className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            CLOSE
          </button>
          {status.loggedIn ? (
            <button type="button" className="btn solid" onClick={logout}>
              LOG OUT
            </button>
          ) : status.pending ? (
            <button type="button" className="btn solid" onClick={() => window.wire.redditCancel()}>
              CANCEL
            </button>
          ) : (
            <button className="btn solid">LOG IN WITH REDDIT</button>
          )}
        </footer>
      </form>
    </div>
  );
}
