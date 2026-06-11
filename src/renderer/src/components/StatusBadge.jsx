import React from 'react'

const CONFIG = {
  pending:   { bg: 'bg-slate-700',   text: 'text-slate-300',  dot: 'bg-slate-400',  label: 'Pending'   },
  sent:      { bg: 'bg-green-900/50', text: 'text-green-400',  dot: 'bg-green-400',  label: 'Sent'      },
  failed:    { bg: 'bg-red-900/50',   text: 'text-red-400',    dot: 'bg-red-400',    label: 'Failed'    },
  skipped:   { bg: 'bg-yellow-900/50',text: 'text-yellow-400', dot: 'bg-yellow-400', label: 'Skipped'   },
  running:   { bg: 'bg-indigo-900/50',text: 'text-indigo-400', dot: 'bg-indigo-400', label: 'Running'   },
  paused:    { bg: 'bg-amber-900/50', text: 'text-amber-400',  dot: 'bg-amber-400',  label: 'Paused'    },
  stopped:   { bg: 'bg-slate-700',   text: 'text-slate-400',  dot: 'bg-slate-500',  label: 'Stopped'   },
  completed: { bg: 'bg-green-900/50', text: 'text-green-400',  dot: 'bg-green-400',  label: 'Completed' },
  created:   { bg: 'bg-slate-700',   text: 'text-slate-300',  dot: 'bg-slate-400',  label: 'Created'   }
}

export default function StatusBadge({ status, pulse = false }) {
  const cfg = CONFIG[status] || CONFIG.pending
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${pulse && status === 'running' ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  )
}
