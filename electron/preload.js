// Exposes a small, explicit API to the renderer as window.wire.
const { contextBridge, ipcRenderer } = require('electron');

const subscribe = (channel) => (cb) => {
  const handler = (_e, payload) => cb(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld('wire', {
  getState: () => ipcRenderer.invoke('state:get'),
  saveSource: (src) => ipcRenderer.invoke('source:save', src),
  removeSource: (id) => ipcRenderer.invoke('source:remove', id),
  refresh: (id) => ipcRenderer.invoke('source:refresh', id),
  watch: (item) => ipcRenderer.invoke('watch:add', item),
  unwatch: (key) => ipcRenderer.invoke('watch:remove', key),
  open: (url) => ipcRenderer.invoke('open', url),
  redditLogin: (creds) => ipcRenderer.invoke('reddit:login', creds),
  redditCancel: () => ipcRenderer.invoke('reddit:cancel'),
  redditLogout: () => ipcRenderer.invoke('reddit:logout'),
  onReddit: subscribe('reddit'),
  onFeed: subscribe('feed'),
  onFeedRemoved: subscribe('feed:removed'),
  onSources: subscribe('sources'),
  onWatch: subscribe('watch'),
  onLog: subscribe('log'),
});
