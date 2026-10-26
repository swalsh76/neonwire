# NEONWIRE // signal monitor

A desktop app that polls news sites, forums and APIs, merges everything into one live stream, and tracks how individual threads grow over time. It's built with Electron and React, styled after the steel-blue, ring-and-readout screens of *Ghost in the Shell: Stand Alone Complex*.

## Features

- **Multi-source polling**: Hacker News, Reddit, 4chan boards, any RSS/Atom feed, and any JSON API (you map its fields with dot paths). Each source has its own poll interval and color.
- **Live stream**: all sources merged into one list. Sort by latest, hot (points per hour), top, or arrival order. New items get a flash and a `NEW` badge. Press `/` to search.
- **Thread tracking**: hit `TRACK` on any item to record its score and comment count over time. Each tracked item gets a sparkline plus total and last-hour deltas. HN threads keep updating every 60s even after they drop off the front page.
- **Desktop notifications** for new items, toggled per source.
- **Newswire ticker and console log** at the bottom of the window.
- Quick presets for HN lists, subreddits, Lobsters, DEV, Slashdot, TechCrunch, Wired, BBC, GitHub release feeds, and more.

## Run

```bash
npm install
npm run dev     # Vite dev server + Electron with hot reload
npm start       # production build, then launch
```

Requires Node 20+.

## Build the installer

```bash
npm run dist    # → release/NEONWIRE-Setup-<version>.exe
npm run pack    # unpacked app only, in release/win-unpacked (quick smoke test)
```

This produces a Windows NSIS installer. It installs per-user (no admin), lets you pick the install folder, adds Start-menu and desktop shortcuts, and registers an uninstaller. Running `npm run dist` on macOS or Linux builds a `.dmg` or AppImage instead. The app icon source is `build/icon.svg`, and `build/icon.png` is the 512px render electron-builder uses.

### Releases

GitHub Actions builds the installer for you (`.github/workflows/release.yml`):

```bash
git tag v0.2.0 && git push origin v0.2.0
```

That builds `NEONWIRE-Setup-0.2.0.exe` and publishes it as a GitHub Release with auto-generated notes. The version comes from the tag, so you don't need to bump `package.json` first. To get a test build without cutting a release, use **Actions → Release → Run workflow**; the installer then appears as a downloadable artifact on the run.

The installer isn't code-signed, so Windows SmartScreen will warn on first run ("More info → Run anyway"). Settings and tracking history live in `%APPDATA%\neonwire` and survive uninstalls and upgrades.

> npm 11+ blocks dependency install scripts unless they're allowlisted. `package.json` → `allowScripts` approves Electron's (it downloads the Electron binary). If `node_modules/electron/dist` is missing after `npm install`, run `node node_modules/electron/install.js`.

> If Electron crashes on launch with `Cannot read properties of undefined (reading 'handle')`, your shell has `ELECTRON_RUN_AS_NODE=1` set (some editor-spawned terminals do). Unset it and run again.

## Architecture

```
electron/
  main.js       window, per-source poll scheduler, thread tracking, IPC
  fetchers.js   one fetcher per source type → normalized items
  reddit-auth.js  Reddit OAuth (loopback redirect, encrypted refresh token)
  store.js      JSON persistence in the app's userData folder
  preload.js    window.wire bridge (contextIsolation, sandboxed)
src/
  App.jsx       state: subscribes to feed/watch/log events from main
  components/   TopBar, Sidebar, Stream, Watchlist, Sparkline, Console, SourceModal
  lib/          formatting helpers + source presets
```

All network fetching happens in the main process, so there are no CORS issues. The renderer only gets normalized items:
`{ key, title, url, discussionUrl, author, score, comments, time, summary, firstSeen }`.

To add a new source type, write a fetcher in `electron/fetchers.js`, register it in `FETCHERS` (and `SOURCE_TYPES` in `main.js`), and add its form fields in `SourceModal.jsx`.

Config and history live in `%APPDATA%/neonwire/neonwire.json`.

## Notes

### 4chan boards

Click **4CHAN** at the bottom of the sidebar, next to REDDIT, and check the boards you want. Worksafe boards (the former 4channel.org boards) are listed first; NSFW boards stay hidden until you tick **Show NSFW boards**. Each checked board becomes a source that polls its catalog in bump order.

The stream shows **thread names only**: the subject line, or the opening text of the first post when there's no subject (like 4chan's own catalog). No images and no post text. Reply counts are shown, and tracked threads update from the thread API. NEONWIRE follows 4chan's API rules: at most one request per second, plus `If-Modified-Since` so unchanged catalogs aren't downloaded again.

### Reddit login

Without a login, Reddit sources fall back to RSS: headlines only, with no scores or comment counts. Reddit blocks most anonymous API requests. Click **REDDIT** at the bottom of the sidebar to log in:

1. Create an app at <https://www.reddit.com/prefs/apps> of type **installed app**.
2. Set its redirect URI to `http://127.0.0.1:65010/callback`.
3. Paste the client ID into NEONWIRE and click **Log in with Reddit**. Your browser opens Reddit's authorization page.

Once you're logged in, Reddit sources use the official API, so thread tracking works for Reddit posts too. A Reddit source with a blank subreddit streams your personal front page.

The refresh token (and the client secret, if you use a "web app" or "script" type) is encrypted with the OS keystore via Electron `safeStorage`. Logging out revokes the token with Reddit.

> Since Nov 2025, Reddit requires approval for **new** API apps under its Responsible Builder Policy. Apps registered before then keep working.
