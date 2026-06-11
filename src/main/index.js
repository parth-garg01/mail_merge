const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const crypto = require('crypto')
const Store = require('electron-store')
const { v4: uuidv4 } = require('uuid')

const sheetParser = require('./SheetParser')
const templateEngine = require('./TemplateEngine')
const scheduleController = require('./ScheduleController')
const sendQueue = require('./SendQueue')
const gmailClient = require('./GmailClient')
const logger = require('./Logger')

const configStore = new Store({ name: 'app-config' })

let mainWindow = null
const activeCampaigns = {} // campaignId -> { paused, stopped, timeout, cfg, tick }

function buildCfg(schedule) {
  return {
    allowedDays: schedule?.allowedDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    windowStart: schedule?.windowStart || '00:00',
    windowEnd: schedule?.windowEnd || '23:59',
    intervalMinutes: Number(schedule?.intervalMinutes) || 5,
    startAt: schedule?.startAt || null
  }
}

const TRANSIENT_CODES = new Set(['ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENETUNREACH', 'EAI_AGAIN'])

function isTransientError(err) {
  if (TRANSIENT_CODES.has(err.code)) return true
  const status = err?.response?.status || err?.status
  if (status >= 500 && status < 600) return true
  const msg = (err.message || '').toLowerCase()
  return msg.includes('network') || msg.includes('enotfound') || msg.includes('timeout') || msg.includes('socket hang up')
}

// ─── Window ──────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../out/renderer/index.html'))
  }
}

app.whenReady().then(() => {
  logger.init(app.getPath('userData'))

  const clientId = configStore.get('googleClientId', process.env.GOOGLE_CLIENT_ID)
  const clientSecret = configStore.get('googleClientSecret', process.env.GOOGLE_CLIENT_SECRET)
  if (clientId && clientSecret) {
    gmailClient.init(clientId, clientSecret)
  }

  createWindow()
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow() })

  // Resume any running campaigns that were interrupted
  const campaigns = configStore.get('campaigns', {})
  for (const [id, c] of Object.entries(campaigns)) {
    if (c.status === 'running') {
      runCampaign(id, c)
    }
  }
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

// ─── Helpers ─────────────────────────────────────────────────────────────────

function notify(event, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(event, data)
  }
}

function saveCampaign(campaign) {
  const campaigns = configStore.get('campaigns', {})
  campaigns[campaign.id] = { ...campaign, updatedAt: new Date().toISOString() }
  configStore.set('campaigns', campaigns)
}

// ─── Auth (app password) ──────────────────────────────────────────────────────

function hashPwd(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex')
}

ipcMain.handle('auth:status', async () => ({
  hasPassword: !!configStore.get('appPasswordHash')
}))

ipcMain.handle('auth:unlock', async (_, password) => {
  const stored = configStore.get('appPasswordHash')
  if (!stored) return { success: true }
  return { success: hashPwd(password) === stored }
})

ipcMain.handle('auth:setPassword', async (_, { currentPassword, newPassword }) => {
  const stored = configStore.get('appPasswordHash')
  if (stored && hashPwd(currentPassword) !== stored) {
    return { success: false, error: 'Current password is incorrect.' }
  }
  if (!newPassword || newPassword.length < 4) {
    return { success: false, error: 'Password must be at least 4 characters.' }
  }
  configStore.set('appPasswordHash', hashPwd(newPassword))
  return { success: true }
})

ipcMain.handle('auth:removePassword', async (_, { currentPassword }) => {
  const stored = configStore.get('appPasswordHash')
  if (!stored) return { success: true }
  if (hashPwd(currentPassword) !== stored) {
    return { success: false, error: 'Incorrect password.' }
  }
  configStore.delete('appPasswordHash')
  return { success: true }
})

// ─── Sheet ────────────────────────────────────────────────────────────────────

ipcMain.handle('sheet:openDialog', async () => {
  const options = {
    properties: ['openFile'],
    filters: [{ name: 'Spreadsheets', extensions: ['xlsx', 'xls', 'csv'] }]
  }

  const owner = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
  const result = owner
    ? await dialog.showOpenDialog(owner, options)
    : await dialog.showOpenDialog(options)

  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('sheet:parse', async (_, filePath) => {
  try {
    return { success: true, data: sheetParser.parse(filePath) }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('sheet:validate', async (_, { filePath, parsedData, emailColumn }) => {
  return sheetParser.validate(parsedData, emailColumn)
})

// ─── Template ─────────────────────────────────────────────────────────────────

ipcMain.handle('template:validate', async (_, { subjectTemplate, bodyTemplate, headers }) => {
  return {
    subject: templateEngine.validate(subjectTemplate, headers),
    body: templateEngine.validate(bodyTemplate, headers)
  }
})

ipcMain.handle('template:preview', async (_, { subjectTemplate, bodyTemplate, row }) => {
  return {
    subject: templateEngine.merge(subjectTemplate, row),
    body: templateEngine.merge(bodyTemplate, row)
  }
})

// ─── Gmail ────────────────────────────────────────────────────────────────────

ipcMain.handle('gmail:status', async () => ({
  authenticated: gmailClient.isAuthenticated(),
  email: gmailClient.getConnectedEmail()
}))

ipcMain.handle('gmail:auth', async () => {
  try {
    return await gmailClient.startAuth()
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('gmail:revoke', async () => {
  await gmailClient.revokeToken()
  return { success: true }
})

ipcMain.handle('gmail:setCredentials', async (_, { clientId, clientSecret }) => {
  configStore.set('googleClientId', clientId)
  configStore.set('googleClientSecret', clientSecret)
  gmailClient.init(clientId, clientSecret)
  return { success: true }
})

// ─── Campaign ─────────────────────────────────────────────────────────────────

ipcMain.handle('campaign:create', async (_, config) => {
  const id = uuidv4()
  const campaign = {
    ...config,
    id,
    status: 'created',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  saveCampaign(campaign)
  return { success: true, campaignId: id }
})

ipcMain.handle('campaign:list', async () => {
  const campaigns = configStore.get('campaigns', {})
  return Object.values(campaigns).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
})

ipcMain.handle('campaign:get', async (_, id) => {
  return configStore.get('campaigns', {})[id] || null
})

ipcMain.handle('campaign:delete', async (_, id) => {
  const campaigns = configStore.get('campaigns', {})
  delete campaigns[id]
  configStore.set('campaigns', campaigns)
  sendQueue.clearQueue(id)
  logger.clearLogs(id)
  return { success: true }
})

ipcMain.handle('campaign:initQueue', async (_, { campaignId, recipients, emailColumn }) => {
  const queue = sendQueue.initQueue(campaignId, recipients, emailColumn)
  return { success: true, queue, stats: sendQueue.getStats(campaignId) }
})

ipcMain.handle('campaign:start', async (_, campaignId) => {
  const campaigns = configStore.get('campaigns', {})
  const campaign = campaigns[campaignId]
  if (!campaign) return { success: false, error: 'Campaign not found' }

  campaign.status = 'running'
  saveCampaign(campaign)
  runCampaign(campaignId, campaign)
  return { success: true }
})

ipcMain.handle('campaign:pause', async (_, campaignId) => {
  if (activeCampaigns[campaignId]) {
    activeCampaigns[campaignId].paused = true
    clearTimeout(activeCampaigns[campaignId].timeout)
  }
  const campaigns = configStore.get('campaigns', {})
  if (campaigns[campaignId]) {
    campaigns[campaignId].status = 'paused'
    saveCampaign(campaigns[campaignId])
  }
  return { success: true }
})

ipcMain.handle('campaign:resume', async (_, campaignId) => {
  const campaigns = configStore.get('campaigns', {})
  const campaign = campaigns[campaignId]
  if (!campaign) return { success: false, error: 'Campaign not found' }

  campaign.status = 'running'
  saveCampaign(campaign)

  if (activeCampaigns[campaignId]) {
    activeCampaigns[campaignId].paused = false
  }
  runCampaign(campaignId, campaign)
  return { success: true }
})

ipcMain.handle('campaign:stop', async (_, campaignId) => {
  if (activeCampaigns[campaignId]) {
    activeCampaigns[campaignId].stopped = true
    clearTimeout(activeCampaigns[campaignId].timeout)
    delete activeCampaigns[campaignId]
  }
  const campaigns = configStore.get('campaigns', {})
  if (campaigns[campaignId]) {
    campaigns[campaignId].status = 'stopped'
    saveCampaign(campaigns[campaignId])
  }
  return { success: true }
})

ipcMain.handle('campaign:updateSchedule', async (_, { campaignId, schedule }) => {
  const campaigns = configStore.get('campaigns', {})
  const campaign = campaigns[campaignId]
  if (!campaign) return { success: false, error: 'Campaign not found' }

  campaign.schedule = { ...campaign.schedule, ...schedule }
  saveCampaign(campaign)

  const ctx = activeCampaigns[campaignId]
  if (ctx && !ctx.stopped) {
    ctx.cfg = buildCfg(campaign.schedule)
    // Wake up the runner so it immediately re-evaluates the new schedule
    clearTimeout(ctx.timeout)
    ctx.tick?.()
  }

  return { success: true, campaign }
})

// ─── Queue ────────────────────────────────────────────────────────────────────

ipcMain.handle('queue:get', async (_, campaignId) => sendQueue.getQueue(campaignId))
ipcMain.handle('queue:stats', async (_, campaignId) => sendQueue.getStats(campaignId))
ipcMain.handle('queue:skip', async (_, { campaignId, recipientId }) => {
  sendQueue.updateStatus(campaignId, recipientId, 'skipped', { errorMessage: 'Manually skipped' })
  return { success: true }
})
ipcMain.handle('queue:retry', async (_, { campaignId, recipientId }) => {
  const result = sendQueue.retryFailed(campaignId, recipientId)
  if (!result.success) return result

  const campaigns = configStore.get('campaigns', {})
  const campaign = campaigns[campaignId]
  if (campaign && campaign.status !== 'running') {
    campaign.status = 'running'
    saveCampaign(campaign)
  }

  if (campaign && (!activeCampaigns[campaignId] || activeCampaigns[campaignId].stopped || activeCampaigns[campaignId].paused)) {
    if (activeCampaigns[campaignId]) {
      clearTimeout(activeCampaigns[campaignId].timeout)
      delete activeCampaigns[campaignId]
    }
    runCampaign(campaignId, campaign)
  }

  return { ...result, stats: sendQueue.getStats(campaignId) }
})

// ─── Logs ─────────────────────────────────────────────────────────────────────

ipcMain.handle('log:get', async (_, campaignId) => logger.getLogs(campaignId))
ipcMain.handle('log:export', async (_, campaignId) => {
  const p = logger.exportCSV(campaignId)
  return { success: !!p, path: p }
})

// ─── Settings ─────────────────────────────────────────────────────────────────

ipcMain.handle('settings:get', async () => ({
  defaultInterval: 5,
  defaultWindowStart: '08:00',
  defaultWindowEnd: '15:00',
  defaultAllowedDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  googleClientId: configStore.get('googleClientId', ''),
  googleClientSecret: configStore.get('googleClientSecret', ''),
  ...configStore.get('settings', {})
}))

ipcMain.handle('settings:save', async (_, settings) => {
  configStore.set('settings', settings)
  if (settings.googleClientId && settings.googleClientSecret) {
    configStore.set('googleClientId', settings.googleClientId)
    configStore.set('googleClientSecret', settings.googleClientSecret)
    gmailClient.init(settings.googleClientId, settings.googleClientSecret)
  }
  return { success: true }
})

// ─── Campaign Runner ──────────────────────────────────────────────────────────

async function runCampaign(campaignId, campaign) {
  if (!activeCampaigns[campaignId]) {
    activeCampaigns[campaignId] = { paused: false, stopped: false, timeout: null, cfg: null, tick: null }
  }
  const ctx = activeCampaigns[campaignId]
  ctx.cfg = buildCfg(campaign.schedule)

  const tick = async () => {
    if (ctx.stopped || ctx.paused) return

    const cfg = ctx.cfg  // always read latest — may be updated by campaign:updateSchedule

    // Wait for scheduled start time
    if (!scheduleController.isCampaignStartTimeReached(cfg.startAt)) {
      const msWait = scheduleController.msUntilStartTime(cfg.startAt)
      notify('campaign:waiting', { campaignId, msToWait: msWait, reason: 'Waiting for scheduled start' })
      ctx.timeout = setTimeout(tick, Math.min(msWait, 30000))
      return
    }

    if (!sendQueue.hasPending(campaignId)) {
      const campaigns = configStore.get('campaigns', {})
      if (campaigns[campaignId]) {
        campaigns[campaignId].status = 'completed'
        saveCampaign(campaigns[campaignId])
      }
      notify('campaign:complete', { campaignId })
      delete activeCampaigns[campaignId]
      return
    }

    if (!scheduleController.shouldSendNow(cfg)) {
      const msWait = scheduleController.msUntilNextValidWindow(cfg)
      notify('campaign:waiting', { campaignId, msToWait: msWait, reason: 'Outside sending window' })
      ctx.timeout = setTimeout(tick, Math.min(msWait, 60000))
      return
    }

    const recipient = sendQueue.getNext(campaignId)
    if (!recipient) return

    const subject = templateEngine.merge(campaign.subjectTemplate || '', recipient.fields)
    const body = templateEngine.merge(campaign.bodyTemplate || '', recipient.fields)
    sendQueue.updateStatus(campaignId, recipient.id, 'sending')

    try {
      await gmailClient.send(recipient.email, subject, body)
      const updated = sendQueue.updateStatus(campaignId, recipient.id, 'sent', {
        sentAt: new Date().toISOString()
      })
      logger.log(campaignId, { email: recipient.email, subject, status: 'sent', errorMessage: null })
      notify('campaign:sent', { campaignId, recipient: updated, stats: sendQueue.getStats(campaignId) })

      const intervalMs = scheduleController.addJitter(cfg.intervalMinutes * 60 * 1000)
      notify('campaign:nextSend', { campaignId, nextSendAt: Date.now() + intervalMs })
      ctx.timeout = setTimeout(tick, intervalMs)
    } catch (err) {
      if (isTransientError(err)) {
        // Network/connectivity issue — reset to pending and retry after 2 min
        sendQueue.updateStatus(campaignId, recipient.id, 'pending')
        const retryMs = 2 * 60 * 1000
        notify('campaign:waiting', { campaignId, msToWait: retryMs, reason: 'No internet — will retry automatically' })
        ctx.timeout = setTimeout(tick, retryMs)
      } else {
        // Permanent failure (bad auth, invalid address, API rejection, etc.)
        const updated = sendQueue.updateStatus(campaignId, recipient.id, 'failed', {
          errorMessage: err.message
        })
        logger.log(campaignId, { email: recipient.email, subject, status: 'failed', errorMessage: err.message })
        notify('campaign:failed', { campaignId, recipient: updated, error: err.message })

        const intervalMs = scheduleController.addJitter(cfg.intervalMinutes * 60 * 1000)
        notify('campaign:nextSend', { campaignId, nextSendAt: Date.now() + intervalMs })
        ctx.timeout = setTimeout(tick, intervalMs)
      }
    }
  }

  ctx.tick = tick
  tick()
}
