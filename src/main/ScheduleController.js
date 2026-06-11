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

  // Returns an array of Date objects — one exact send time per recipient.
  // Respects allowedDays, windowStart/End, and intervalMinutes.
  // All times are at least MIN_LEAD_MS in the future (Gmail requires ~5 min).
  calcSendTimes(count, schedule) {
    if (count === 0) return []
    const { startAt, windowStart, windowEnd, allowedDays, intervalMinutes } = schedule
    const MIN_LEAD_MS = 6 * 60 * 1000  // 6-min buffer so Gmail accepts the schedule

    const minStart = new Date(Date.now() + MIN_LEAD_MS)
    let cursor = startAt ? new Date(Math.max(new Date(startAt).getTime(), minStart.getTime())) : minStart
    cursor = this._snapToValidWindow(cursor, allowedDays, windowStart, windowEnd)

    const intervalMs = Math.max(1, Number(intervalMinutes)) * 60 * 1000
    const times = []

    for (let i = 0; i < count; i++) {
      times.push(new Date(cursor))
      cursor = this._snapToValidWindow(
        new Date(cursor.getTime() + intervalMs),
        allowedDays, windowStart, windowEnd
      )
    }

    return times
  }

  // Advance `date` forward until it falls inside an allowed day and daily window.
  _snapToValidWindow(date, allowedDays, windowStart, windowEnd) {
    const [wsH, wsM] = windowStart.split(':').map(Number)
    let d = new Date(date)

    for (let attempt = 0; attempt < 14; attempt++) {
      const dayName = DAY_ORDER[d.getDay()]
      const timeStr = this._formatTime(d)

      if (allowedDays.includes(dayName)) {
        if (timeStr >= windowStart && timeStr < windowEnd) return d  // already valid
        if (timeStr < windowStart) {
          d.setHours(wsH, wsM, 0, 0)  // snap to window start today
          return d
        }
      }

      // Past window end or wrong day — advance to next allowed day's window start
      d.setDate(d.getDate() + 1)
      d.setHours(wsH, wsM, 0, 0)
    }

    return d  // fallback (should not reach here with a valid config)
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
