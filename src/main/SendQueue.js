const Store = require('electron-store')
const { v4: uuidv4 } = require('uuid')

const store = new Store({ name: 'send-queue' })

class SendQueue {
  initQueue(campaignId, recipients, emailColumn) {
    const seen = new Set()
    const queue = recipients.map(row => {
      const email = row[emailColumn] || ''
      const isDuplicate = seen.has(email.toLowerCase())
      if (email) seen.add(email.toLowerCase())

      return {
        id: uuidv4(),
        rowIndex: row._rowIndex,
        email,
        fields: { ...row },
        status: (!email || isDuplicate) ? 'skipped' : 'pending',
        sentAt: null,
        errorMessage: isDuplicate ? 'Duplicate email address' : (email ? null : 'Missing email address')
      }
    })

    store.set(`q.${campaignId}`, queue)
    return queue
  }

  getQueue(campaignId) {
    return store.get(`q.${campaignId}`, [])
  }

  setQueue(campaignId, queue) {
    store.set(`q.${campaignId}`, queue)
  }

  updateStatus(campaignId, recipientId, status, extra = {}) {
    const queue = this.getQueue(campaignId)
    const idx = queue.findIndex(r => r.id === recipientId)
    if (idx !== -1) {
      queue[idx] = { ...queue[idx], status, ...extra }
      store.set(`q.${campaignId}`, queue)
      return queue[idx]
    }
    return null
  }

  retryFailed(campaignId, recipientId) {
    const queue = this.getQueue(campaignId)
    const idx = queue.findIndex(r => r.id === recipientId)
    if (idx === -1) return { success: false, error: 'Recipient not found.' }

    const recipient = queue[idx]
    if (recipient.status !== 'failed') {
      return { success: false, error: 'Only failed recipients can be retried.' }
    }

    const email = String(recipient.email || '').toLowerCase()
    const alreadySent = queue.some(r => r.id !== recipientId && String(r.email || '').toLowerCase() === email && r.status === 'sent')
    if (alreadySent) {
      return { success: false, error: 'This email address already has a sent message in this campaign.' }
    }

    queue[idx] = {
      ...recipient,
      status: 'pending',
      sentAt: null,
      errorMessage: null,
      retryRequestedAt: new Date().toISOString()
    }
    store.set(`q.${campaignId}`, queue)
    return { success: true, recipient: queue[idx] }
  }

  getNext(campaignId) {
    const queue = this.getQueue(campaignId)
    return queue.find(r => r.status === 'pending') || null
  }

  hasPending(campaignId) {
    const queue = this.getQueue(campaignId)
    return queue.some(r => r.status === 'pending')
  }

  getStats(campaignId) {
    const queue = this.getQueue(campaignId)
    return {
      total: queue.length,
      sent: queue.filter(r => r.status === 'sent').length,
      pending: queue.filter(r => r.status === 'pending').length,
      failed: queue.filter(r => r.status === 'failed').length,
      sending: queue.filter(r => r.status === 'sending').length,
      skipped: queue.filter(r => r.status === 'skipped').length
    }
  }

  clearQueue(campaignId) {
    store.delete(`q.${campaignId}`)
  }
}

module.exports = new SendQueue()
