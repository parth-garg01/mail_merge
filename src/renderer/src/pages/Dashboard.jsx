import React, { useState, useEffect } from 'react'
import { useApp } from '../App'
import StatusBadge from '../components/StatusBadge'
import ProgressBar from '../components/ProgressBar'

export default function Dashboard() {
  const { navigate, setActiveCampaignId, resetWizard } = useApp()
  const [campaigns, setCampaigns] = useState([])
  const [queueStats, setQueueStats] = useState({})
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const list = await window.api?.campaign.list() || []
    setCampaigns(list)

    const stats = {}
    for (const c of list) {
      stats[c.id] = await window.api?.queue.stats(c.id) || {}
    }
    setQueueStats(stats)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id) {
    if (!confirm('Delete this campaign and all its data?')) return
    await window.api?.campaign.delete(id)
    load()
  }

  function handleNewCampaign() {
    resetWizard()
    navigate('import')
  }

  const totalSent = campaigns.reduce((a, c) => a + (queueStats[c.id]?.sent || 0), 0)
  const running = campaigns.filter(c => c.status === 'running').length
  const completed = campaigns.filter(c => c.status === 'completed').length

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Manage your email outreach campaigns</p>
        </div>
        <button onClick={handleNewCampaign} className="btn-primary flex items-center gap-2">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          New Campaign
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Sent', value: totalSent, color: 'text-green-400' },
          { label: 'Running', value: running, color: 'text-indigo-400' },
          { label: 'Completed', value: completed, color: 'text-slate-300' }
        ].map(s => (
          <div key={s.label} className="card">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Campaign list */}
      {loading ? (
        <div className="text-center py-16 text-slate-500">Loading campaigns…</div>
      ) : campaigns.length === 0 ? (
        <div className="card text-center py-16">
          <div className="w-14 h-14 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-7 h-7 text-slate-400">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
          </div>
          <p className="text-slate-300 font-medium mb-1">No campaigns yet</p>
          <p className="text-slate-500 text-sm mb-6">Import a spreadsheet to get started</p>
          <button onClick={handleNewCampaign} className="btn-primary">Create First Campaign</button>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-slate-400 font-medium px-6 py-3">Campaign</th>
                <th className="text-left text-slate-400 font-medium px-4 py-3">Status</th>
                <th className="text-left text-slate-400 font-medium px-4 py-3">Progress</th>
                <th className="text-left text-slate-400 font-medium px-4 py-3">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c, i) => {
                const stats = queueStats[c.id] || {}
                return (
                  <tr
                    key={c.id}
                    className={`border-b border-slate-700/50 last:border-0 hover:bg-slate-700/30 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-800/30'}`}
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-100 truncate max-w-xs">{c.name || 'Untitled Campaign'}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{stats.total || 0} recipients</p>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={c.status} pulse />
                    </td>
                    <td className="px-4 py-4 w-40">
                      <ProgressBar sent={stats.sent || 0} total={stats.total || 0} />
                    </td>
                    <td className="px-4 py-4 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => { setActiveCampaignId(c.id); navigate('monitor') }}
                          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="text-xs text-red-500 hover:text-red-400 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
