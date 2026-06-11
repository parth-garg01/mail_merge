import React, { useState, useEffect } from 'react'
import { useApp } from '../App'
import StatusBadge from '../components/StatusBadge'

export default function Logs() {
  const { activeCampaignId } = useApp()
  const [campaigns, setCampaigns] = useState([])
  const [selectedId, setSelectedId] = useState(activeCampaignId || '')
  const [logs, setLogs] = useState([])
  const [filter, setFilter] = useState('all')
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState('')

  useEffect(() => {
    window.api?.campaign.list().then(list => {
      setCampaigns(list)
      if (!selectedId && list.length > 0) setSelectedId(list[0].id)
    })
  }, [])

  useEffect(() => {
    if (selectedId) {
      window.api?.log.get(selectedId).then(setLogs)
    }
  }, [selectedId])

  async function handleExport() {
    setExporting(true)
    setExportMsg('')
    const result = await window.api?.log.export(selectedId)
    setExporting(false)
    if (result?.success) {
      setExportMsg(`Exported to: ${result.path}`)
    } else {
      setExportMsg('No logs to export or export failed.')
    }
    setTimeout(() => setExportMsg(''), 5000)
  }

  const filtered = filter === 'all' ? logs : logs.filter(l => l.status === filter)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Send Logs</h1>
          <p className="text-slate-400 text-sm mt-1">Detailed record of every send attempt</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || !selectedId || logs.length === 0}
          className="btn-secondary flex items-center gap-2"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {exportMsg && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-700/50 rounded-lg text-green-300 text-sm">
          {exportMsg}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 mb-5">
        <div className="flex-1">
          <label className="label">Campaign</label>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="input-field max-w-xs"
          >
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.name || 'Untitled'}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Status Filter</label>
          <div className="flex gap-1">
            {['all', 'sent', 'failed'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  filter === f ? 'bg-slate-700 text-slate-100' : 'bg-slate-800 text-slate-500 hover:text-slate-300 border border-slate-700'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f !== 'all' && (
                  <span className="ml-1.5 text-slate-500">
                    ({logs.filter(l => l.status === f).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/50">
                <th className="text-left text-slate-400 font-medium px-5 py-3">Timestamp</th>
                <th className="text-left text-slate-400 font-medium px-4 py-3">Email</th>
                <th className="text-left text-slate-400 font-medium px-4 py-3">Subject</th>
                <th className="text-left text-slate-400 font-medium px-4 py-3">Status</th>
                <th className="text-left text-slate-400 font-medium px-4 py-3">Error</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log, i) => (
                <tr key={i} className="border-b border-slate-700/40 last:border-0 hover:bg-slate-700/20">
                  <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-300 font-medium">{log.email}</td>
                  <td className="px-4 py-3 text-slate-400 max-w-[240px] truncate">{log.subject}</td>
                  <td className="px-4 py-3"><StatusBadge status={log.status} /></td>
                  <td className="px-4 py-3 text-red-400 text-xs max-w-[200px] truncate">
                    {log.errorMessage || '—'}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                    {!selectedId ? 'Select a campaign to view logs' : 'No logs found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-700 text-xs text-slate-500">
            Showing {filtered.length} of {logs.length} entries
          </div>
        )}
      </div>
    </div>
  )
}
