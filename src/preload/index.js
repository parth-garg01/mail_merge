const { contextBridge, ipcRenderer } = require('electron')

const VALID_EVENTS = [
  'campaign:sent',
  'campaign:failed',
  'campaign:complete',
  'campaign:waiting',
  'campaign:nextSend'
]

contextBridge.exposeInMainWorld('api', {
  sheet: {
    openDialog: () => ipcRenderer.invoke('sheet:openDialog'),
    parse: filePath => ipcRenderer.invoke('sheet:parse', filePath),
    validate: params => ipcRenderer.invoke('sheet:validate', params)
  },

  template: {
    validate: params => ipcRenderer.invoke('template:validate', params),
    preview: params => ipcRenderer.invoke('template:preview', params)
  },

  gmail: {
    status: () => ipcRenderer.invoke('gmail:status'),
    auth: () => ipcRenderer.invoke('gmail:auth'),
    revoke: () => ipcRenderer.invoke('gmail:revoke'),
    setCredentials: creds => ipcRenderer.invoke('gmail:setCredentials', creds)
  },

  campaign: {
    create: config => ipcRenderer.invoke('campaign:create', config),
    list: () => ipcRenderer.invoke('campaign:list'),
    get: id => ipcRenderer.invoke('campaign:get', id),
    delete: id => ipcRenderer.invoke('campaign:delete', id),
    initQueue: params => ipcRenderer.invoke('campaign:initQueue', params),
    start: id => ipcRenderer.invoke('campaign:start', id),
    pause: id => ipcRenderer.invoke('campaign:pause', id),
    resume: id => ipcRenderer.invoke('campaign:resume', id),
    stop: id => ipcRenderer.invoke('campaign:stop', id)
  },

  queue: {
    get: campaignId => ipcRenderer.invoke('queue:get', campaignId),
    stats: campaignId => ipcRenderer.invoke('queue:stats', campaignId),
    skip: params => ipcRenderer.invoke('queue:skip', params),
    retry: params => ipcRenderer.invoke('queue:retry', params)
  },

  log: {
    get: campaignId => ipcRenderer.invoke('log:get', campaignId),
    export: campaignId => ipcRenderer.invoke('log:export', campaignId)
  },

  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: settings => ipcRenderer.invoke('settings:save', settings)
  },

  on: (channel, cb) => {
    if (VALID_EVENTS.includes(channel)) {
      ipcRenderer.on(channel, (_, data) => cb(data))
    }
  },

  off: (channel, cb) => {
    if (VALID_EVENTS.includes(channel)) {
      ipcRenderer.removeListener(channel, cb)
    }
  }
})
