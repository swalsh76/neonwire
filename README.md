# NEONWIRE // signal monitor

A desktop app that polls news sites, forums and APIs, merges everything into one live stream, and tracks how individual threads grow over time. It's built with Electron and React, with a bright cyberpunk look.

## Features

- **Multi-source polling**: Hacker News, Reddit, any RSS/Atom feed, and any JSON API (you map its fields with dot paths). Each source has its own poll interval and color.
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

> If Electron crashes on launch with `Cannot read properties of undefined (reading 'handle')`, your shell has `ELECTRON_RUN_AS_NODE=1` set (some editor-spawned terminals do). Unset it and run again.

## Architecture

```
electron/
  main.js       window, per-source poll scheduler, thread tracking, IPC
  fetchers.js   one fetcher per source type → normalized items
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

- Reddit often blocks anonymous JSON requests. NEONWIRE then falls back to the subreddit's RSS feed, which has no scores or comment counts.
