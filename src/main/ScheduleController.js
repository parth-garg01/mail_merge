const DAY_ORDER = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

class ScheduleController {
  shouldSendNow(config) {
    const now = new Date()
    const day = DAY_ORDER[now.getDay()]
    const time = this._formatTime(now)

    if (!config.allowedDays.includes(day)) return false
    if (time < config.windowStart || time >= config.windowEnd) return false
    return true
  }

  msUntilNextValidWindow(config) {
    const now = new Date()
    const day = DAY_ORDER[now.getDay()]
    const time = this._formatTime(now)

    // If today is allowed but we're before the window, wait until window opens
    if (config.allowedDays.includes(day) && time < config.windowStart) {
      return this._msUntilTime(now, config.windowStart)
    }

    // Find the next allowed day (up to 7 days out)
    for (let i = 1; i <= 7; i++) {
      const nextDayIdx = (now.getDay() + i) % 7
      const nextDayName = DAY_ORDER[nextDayIdx]
      if (config.allowedDays.includes(nextDayName)) {
        const [h, m] = config.windowStart.split(':').map(Number)
        const next = new Date(now)
        next.setDate(next.getDate() + i)
        next.setHours(h, m, 0, 0)
        return next - now
      }
    }

    return 24 * 60 * 60 * 1000
  }

  addJitter(baseMs, jitterSeconds = 30) {
    const jitter = (Math.random() * 2 - 1) * jitterSeconds * 1000
    return Math.max(60000, baseMs + jitter) // minimum 1 minute
  }

  isCampaignStartTimeReached(startAt) {
    if (!startAt) return true
    return new Date() >= new Date(startAt)
  }

  msUntilStartTime(startAt) {
    if (!startAt) return 0
    return Math.max(0, new Date(startAt) - new Date())
  }

  _formatTime(date) {
    const h = String(date.getHours()).padStart(2, '0')
    const m = String(date.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
  }

  _msUntilTime(from, timeStr) {
    const [h, m] = timeStr.split(':').map(Number)
    const target = new Date(from)
    target.setHours(h, m, 0, 0)
    return target - from
  }
}

module.exports = new ScheduleController()
