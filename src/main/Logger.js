const fs = require('fs')
const path = require('path')

let logsDir = null

function getLogsDir() {
  if (!logsDir) {
    // app.getPath is only available after app is ready; we set it via init()
    logsDir = path.join(require('os').homedir(), '.smart-mail-merger', 'logs')
    fs.mkdirSync(logsDir, { recursive: true })
  }
  return logsDir
}

class Logger {
  init(userDataPath) {
    logsDir = path.join(userDataPath, 'logs')
    fs.mkdirSync(logsDir, { recursive: true })
  }

  _logPath(campaignId) {
    return path.join(getLogsDir(), `campaign-${campaignId}.json`)
  }

  log(campaignId, entry) {
    const p = this._logPath(campaignId)
    let entries = []
    if (fs.existsSync(p)) {
      try { entries = JSON.parse(fs.readFileSync(p, 'utf8')) } catch {}
    }
    entries.push({ ...entry, timestamp: new Date().toISOString() })
    fs.writeFileSync(p, JSON.stringify(entries, null, 2))
  }

  getLogs(campaignId) {
    const p = this._logPath(campaignId)
    if (!fs.existsSync(p)) return []
    try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return [] }
  }

  exportCSV(campaignId) {
    const logs = this.getLogs(campaignId)
    if (!logs.length) return null

    const cols = ['timestamp', 'email', 'subject', 'status', 'errorMessage']
    const escape = v => `"${String(v || '').replace(/"/g, '""')}"`
    const csv = [
      cols.join(','),
      ...logs.map(l => cols.map(c => escape(l[c])).join(','))
    ].join('\n')

    const out = path.join(getLogsDir(), `export-${campaignId}-${Date.now()}.csv`)
    fs.writeFileSync(out, csv)
    return out
  }

  clearLogs(campaignId) {
    const p = this._logPath(campaignId)
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }
}

module.exports = new Logger()
