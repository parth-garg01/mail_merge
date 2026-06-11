import React, { useState } from 'react'
import { useApp } from '../App'

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function ScheduleConfig() {
  const { wizard, updateWizard, navigate, setActiveCampaignId, gmailStatus } = useApp()
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState('')

  const { schedule, campaignName, sheetData, emailColumn, subjectTemplate, bodyTemplate } = wizard

  function setSchedule(patch) {
    updateWizard({ schedule: { ...schedule, ...patch } })
  }

  function toggleDay(day) {
    const days = schedule.allowedDays.includes(day)
      ? schedule.allowedDays.filter(d => d !== day)
      : [...schedule.allowedDays, day]
    setSchedule({ allowedDays: days })
  }

  async function handleStartCampaign() {
    setError('')

    if (!gmailStatus.authenticated) {
      setError('Please connect your Gmail account in Settings before sending.')
      return
    }
    if (!campaignName.trim()) {
      setError('Please enter a campaign name.')
      return
    }
    if (schedule.allowedDays.length === 0) {
      setError('Select at least one allowed day.')
      return
    }
    if (!sheetData || !emailColumn || !subjectTemplate || !bodyTemplate) {
      setError('Please complete the previous steps first.')
      return
    }

    setLaunching(true)

    try {
      // Create campaign record
      const { success, campaignId, error: cerr } = await window.api?.campaign.create({
        name: campaignName.trim(),
        sheetPath: wizard.sheetPath,
        emailColumn,
        subjectTemplate,
        bodyTemplate,
        schedule
      })

      if (!success) throw new Error(cerr)

      // Initialize the send queue
      const { success: qs } = await window.api?.campaign.initQueue({
        campaignId,
        recipients: sheetData.rows,
        emailColumn
      })
      if (!qs) throw new Error('Failed to initialize queue')

      // Start sending
      await window.api?.campaign.start(campaignId)

      setActiveCampaignId(campaignId)
      navigate('monitor', campaignId)
    } catch (err) {
      setError(err.message)
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
          <span onClick={() => navigate('import')} className="text-slate-400 hover:text-indigo-400 cursor-pointer">Step 1</span>
          <span>→</span>
          <span onClick={() => navigate('template')} className="text-slate-400 hover:text-indigo-400 cursor-pointer">Step 2</span>
          <span>→</span><span className="text-indigo-400 font-medium">Step 3</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100">Schedule & Launch</h1>
        <p className="text-slate-400 text-sm mt-1">Configure when and how your campaign runs</p>
      </div>

      <div className="space-y-5">
        {/* Campaign name */}
        <div className="card">
          <label className="label">Campaign Name</label>
          <input
            type="text"
            value={campaignName}
            onChange={e => updateWizard({ campaignName: e.target.value })}
            placeholder="e.g. Professor Outreach — June 2026"
            className="input-field"
          />
        </div>

        {/* Start time */}
        <div className="card">
          <h3 className="text-sm font-medium text-slate-200 mb-4">Start Time</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start Date & Time</label>
              <input
                type="datetime-local"
                value={schedule.startAt}
                onChange={e => setSchedule({ startAt: e.target.value })}
                className="input-field"
              />
              <p className="text-slate-500 text-xs mt-1">Leave empty to start immediately</p>
            </div>
          </div>
        </div>

        {/* Daily window */}
        <div className="card">
          <h3 className="text-sm font-medium text-slate-200 mb-4">Daily Sending Window</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Window Start</label>
              <input
                type="time"
                value={schedule.windowStart}
                onChange={e => setSchedule({ windowStart: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Window End</label>
              <input
                type="time"
                value={schedule.windowEnd}
                onChange={e => setSchedule({ windowEnd: e.target.value })}
                className="input-field"
              />
            </div>
          </div>
          <p className="text-slate-500 text-xs mt-3">
            Emails will only be sent between {schedule.windowStart} and {schedule.windowEnd}
          </p>
        </div>

        {/* Days of week */}
        <div className="card">
          <h3 className="text-sm font-medium text-slate-200 mb-4">Allowed Days</h3>
          <div className="flex gap-2">
            {ALL_DAYS.map(day => {
              const active = schedule.allowedDays.includes(day)
              return (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`w-10 h-10 rounded-lg text-xs font-medium transition-colors ${
                    active
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>
          <p className="text-slate-500 text-xs mt-3">
            {schedule.allowedDays.length === 0
              ? 'No days selected — campaign will not send'
              : `Sending on: ${schedule.allowedDays.join(', ')}`
            }
          </p>
        </div>

        {/* Interval */}
        <div className="card">
          <h3 className="text-sm font-medium text-slate-200 mb-4">Sending Interval</h3>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="1"
              max="60"
              value={schedule.intervalMinutes}
              onChange={e => setSchedule({ intervalMinutes: Number(e.target.value) })}
              className="flex-1 accent-indigo-500"
            />
            <div className="w-24 text-center">
              <span className="text-2xl font-bold text-slate-100">{schedule.intervalMinutes}</span>
              <span className="text-slate-400 text-sm ml-1">min</span>
            </div>
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-1 px-0.5">
            <span>1 min</span>
            <span>30 min</span>
            <span>60 min</span>
          </div>
          <p className="text-slate-500 text-xs mt-3">
            A ±30 second random jitter is added to each interval to avoid spam detection.
          </p>
        </div>

        {/* Summary */}
        <div className="bg-indigo-900/20 border border-indigo-700/40 rounded-xl p-4 text-sm">
          <p className="text-indigo-300 font-medium mb-2">Campaign Summary</p>
          <div className="space-y-1 text-slate-400 text-xs">
            <p>• <strong className="text-slate-300">{sheetData?.rows?.length || 0}</strong> recipients from spreadsheet</p>
            <p>• Sending window: <strong className="text-slate-300">{schedule.windowStart} – {schedule.windowEnd}</strong></p>
            <p>• Interval: <strong className="text-slate-300">{schedule.intervalMinutes} min</strong> between emails</p>
            <p>• Allowed days: <strong className="text-slate-300">{schedule.allowedDays.join(', ')}</strong></p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm">{error}</div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={() => navigate('template')} className="btn-secondary">← Back</button>
          <button
            onClick={handleStartCampaign}
            disabled={launching}
            className="btn-primary flex-1"
          >
            {launching ? 'Starting…' : '🚀 Start Campaign'}
          </button>
        </div>
      </div>
    </div>
  )
}
