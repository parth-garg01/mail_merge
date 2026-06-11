import React from 'react'

export default function ProgressBar({ sent = 0, total = 0, className = '' }) {
  const pct = total > 0 ? Math.round((sent / total) * 100) : 0
  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex justify-between text-xs text-slate-400">
        <span>{sent} of {total} sent</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
