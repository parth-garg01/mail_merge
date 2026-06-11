import React, { useState, useEffect, useCallback } from 'react'
import { useApp } from '../App'
import StatusBadge from '../components/StatusBadge'
import ProgressBar from '../components/ProgressBar'

function formatMs(ms) {
  if (ms <= 0) return '0s'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export default function CampaignMonitor() {
  const { activeCampaignId, navigate } = useApp()
  const [campaign, setCampaign] = useState(null)
  const [queue, setQueue] = useState([])
  const [stats, setStats] = useState({ total: 0, sent: 0, pending: 0, sending: 0, failed: 0, skipped: 0 })
  const [actionMsg, setActionMsg] = useState('')
  const [nextSendAt, setNextSendAt] = useState(null)
  const [countdown, setCountdown] = useState(0)
  const [waitMsg, setWaitMsg] = useState('')
  const [filter, setFilter] = useState('all')

  const load = useCallback(async () => {
    if (!activeCampaignId) return
    const [c, q, s] = await Promise.all([
      window.api?.campaign.get(activeCampaignId),
      window.api?.queue.get(activeCampaignId),
      window.api?.queue.stats(activeCampaignId)
    ])
    if (c) setCampaign(c)
    if (q) setQueue(q)
    if (s) setStats(s)
  }, [activeCampaignId])

  useEffect(() => {
    load()

    const onSent = () => load()
    const onFailed = () => load()
    const onComplete = () => load()
    const onNextSend = ({ nextSendAt: t }) => setNextSendAt(t)
    const onWaiting = ({ msToWait, reason }) => {
      setWaitMsg(reason)
      setNextSendAt(Date.now() + msToWait)
    }

    window.api?.on('campaign:sent', onSent)
    window.api?.on('campaign:failed', onFailed)
    window.api?.on('campaign:complete', onComplete)
    window.api?.on('campaign:nextSend', onNextSend)
    window.api?.on('campaign:waiting', onWaiting)

    return () => {
      window.api?.off('campaign:sent', onSent)
      window.api?.off('campaign:failed', onFailed)
      window.api?.off('campaign:complete', onComplete)
      window.api?.off('campaign:nextSend', onNextSend)
      window.api?.off('campaign:waiting', onWaiting)
    }
  }, [load])

  // Countdown ticker
  useEffect(() => {
    const timer = setInterval(() => {
      if (nextSendAt) setCountdown(Math.max(0, nextSendAt - Date.now()))
    }, 500)
    return () => clearInterval(timer)
  }, [nextSendAt])

  async function handlePause() {
    await window.api?.campaign.pause(activeCampaignId)
    load()
  }

  async function handleResume() {
    await window.api?.campaign.resume(activeCampaignId)
    load()
    setWaitMsg('')
  }

  async function handleStop() {
    if (!confirm('Stop this campaign? This cannot be undone.')) return
    await window.api?.campaign.stop(activeCampaignId)
    load()
  }

  async function handleSkip(recipientId) {
    setActionMsg('')
    await window.api?.queue.skip({ campaignId: activeCampaignId, recipientId })
    load()
  }

  async function handleRetry(recipientId) {
    setActionMsg('')
    const result = await window.api?.queue.retry({ campaignId: activeCampaignId, recipientId })
    if (!result?.success) {
      setActionMsg(result?.error || 'Could not retry this recipient.')
      return
    }
    setWaitMsg('')
    load()
  }

  const filtered = filter === 'all' ? queue : queue.filter(r => r.status === filter)
  const isRunning = campaign?.status === 'running'
  const isPaused = campaign?.status === 'paused'

  if (!activeCampaignId) {
    return (
      <div className="p-8 text-center py-24 text-slate-500">
        No active campaign selected. <button onClick={() => navigate('dashboard')} className="text-indigo-400 hover:underline">Go to Dashboard</button>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{campaign?.name || 'Campaign Monitor'}</h1>
          <div className="flex items-center gap-3 mt-2">
            {campaign && <StatusBadge status={campaign.status} pulse />}
            {isRunning && countdown > 0 && (
              <span className="text-xs text-slate-400">
                Next send in <strong className="text-slate-200">{formatMs(countdown)}</strong>
              </span>
            )}
            {waitMsg && (
              <span className="text-xs text-amber-400">{waitMsg}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <button onClick={handlePause} className="btn-secondary">⏸ Pause</button>
          )}
          {isPaused && (
            <button onClick={handleResume} className="btn-primary">▶ Resume</button>
          )}
          {(isRunning || isPaused) && (
            <button onClick={handleStop} className="btn-danger">■ Stop</button>
          )}
          <button onClick={() => { navigate('logs'); }} className="btn-secondary">View Logs</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Sent', value: stats.sent, color: 'text-green-400' },
          { label: 'Pending', value: stats.pending + (stats.sending || 0), color: 'text-indigo-400' },
          { label: 'Failed', value: stats.failed, color: 'text-red-400' },
          { label: 'Skipped', value: stats.skipped, color: 'text-yellow-400' }
        ].map(s => (
          <div key={s.label} className="card py-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-slate-500 text-xs mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="card mb-6">
        <ProgressBar sent={stats.sent} total={stats.total} />
        {stats.pending > 0 && campaign?.schedule?.intervalMinutes && (
          <p className="text-slate-500 text-xs mt-2">
            Est. remaining: ~{Math.ceil(stats.pending * campaign.schedule.intervalMinutes)} min
          </p>
        )}
      </div>

      {/* Queue table */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
          <div>
            <p className="text-sm font-medium text-slate-300">Recipient Queue</p>
            {actionMsg && <p className="text-xs text-red-400 mt-1">{actionMsg}</p>}
          </div>
          <div className="flex gap-1">
            {['all', 'pending', 'sending', 'sent', 'failed', 'skipped'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  filter === f ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-y-auto max-h-[400px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-800/90 backdrop-blur-sm">
              <tr className="border-b border-slate-700">
                <th className="text-left text-slate-400 font-medium px-5 py-2">Email</th>
                <th className="text-left text-slate-400 font-medium px-4 py-2">Status</th>
                <th className="text-left text-slate-400 font-medium px-4 py-2">Sent At</th>
                <th className="text-left text-slate-400 font-medium px-4 py-2">Error</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-slate-700/40 last:border-0 hover:bg-slate-700/20">
                  <td className="px-5 py-2.5 text-slate-300 font-medium">{r.email}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {r.sentAt ? new Date(r.sentAt).toLocaleTimeString() : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-red-400 max-w-[200px] truncate">
                    {r.errorMessage || '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.status === 'pending' && (
                      <button
                        onClick={() => handleSkip(r.id)}
                        className="text-xs text-slate-500 hover:text-yellow-400 transition-colors"
                      >
                        Skip
                      </button>
                    )}
                    {r.status === 'failed' && (
                      <button
                        onClick={() => handleRetry(r.id)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                    No recipients with status "{filter}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
