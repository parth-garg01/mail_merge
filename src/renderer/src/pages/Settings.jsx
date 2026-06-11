import React, { useState, useEffect } from 'react'
import { useApp } from '../App'

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function Settings() {
  const { gmailStatus, setGmailStatus } = useApp()
  const [settings, setSettings] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [authMsg, setAuthMsg] = useState('')

  useEffect(() => {
    window.api?.settings.get().then(s => setSettings(s || {}))
  }, [])

  function update(patch) {
    setSettings(prev => ({ ...prev, ...patch }))
  }

  function toggleDay(day) {
    const days = settings.defaultAllowedDays || []
    update({
      defaultAllowedDays: days.includes(day)
        ? days.filter(d => d !== day)
        : [...days, day]
    })
  }

  async function handleSave() {
    setSaving(true)
    setSaveMsg('')
    const result = await window.api?.settings.save(settings)
    setSaving(false)
    setSaveMsg(result?.success ? 'Settings saved.' : 'Failed to save.')
    setTimeout(() => setSaveMsg(''), 3000)
  }

  async function handleConnect() {
    setConnecting(true)
    setAuthMsg('')

    if (!settings?.googleClientId || !settings?.googleClientSecret) {
      setAuthMsg('Please enter your Google Client ID and Secret first, then save.')
      setConnecting(false)
      return
    }

    // Save credentials first
    await window.api?.gmail.setCredentials({
      clientId: settings.googleClientId,
      clientSecret: settings.googleClientSecret
    })

    try {
      const result = await window.api?.gmail.auth()
      if (result?.success) {
        const status = await window.api?.gmail.status()
        setGmailStatus(status)
        setAuthMsg(`Connected as ${result.email}`)
      } else {
        setAuthMsg(`Authentication failed: ${result?.error || 'Unknown error'}`)
      }
    } catch (err) {
      setAuthMsg(`Error: ${err.message}`)
    }
    setConnecting(false)
  }

  async function handleRevoke() {
    if (!confirm('Disconnect Gmail account?')) return
    await window.api?.gmail.revoke()
    const status = await window.api?.gmail.status()
    setGmailStatus(status)
    setAuthMsg('Gmail account disconnected.')
  }

  if (!settings) return <div className="p-8 text-slate-500">Loading settings…</div>

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Configure Gmail and campaign defaults</p>
      </div>

      <div className="space-y-5">
        {/* Gmail account */}
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Gmail Account</h3>

          {gmailStatus.authenticated ? (
            <div className="flex items-center justify-between p-3 bg-green-900/20 border border-green-700/40 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <div>
                  <p className="text-sm text-slate-200 font-medium">{gmailStatus.email}</p>
                  <p className="text-xs text-green-400">Connected via OAuth 2.0</p>
                </div>
              </div>
              <button onClick={handleRevoke} className="btn-danger text-xs py-1.5 px-3">Disconnect</button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-amber-900/20 border border-amber-700/40 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <p className="text-sm text-amber-300">Not connected</p>
              </div>
              <button onClick={handleConnect} disabled={connecting} className="btn-primary text-xs py-1.5 px-3">
                {connecting ? 'Opening browser…' : 'Connect Gmail'}
              </button>
            </div>
          )}

          {authMsg && (
            <p className={`mt-2 text-xs ${authMsg.includes('Connected') ? 'text-green-400' : 'text-red-400'}`}>{authMsg}</p>
          )}
        </div>

        {/* Google API credentials */}
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-200 mb-1">Google OAuth Credentials</h3>
          <p className="text-slate-500 text-xs mb-4">
            Create credentials at <span className="text-indigo-400">console.cloud.google.com</span> → Enable Gmail API → OAuth 2.0 Client ID (Desktop App)
          </p>
          <div className="space-y-3">
            <div>
              <label className="label">Client ID</label>
              <input
                type="text"
                value={settings.googleClientId || ''}
                onChange={e => update({ googleClientId: e.target.value })}
                placeholder="123456789-xxx.apps.googleusercontent.com"
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Client Secret</label>
              <input
                type="password"
                value={settings.googleClientSecret || ''}
                onChange={e => update({ googleClientSecret: e.target.value })}
                placeholder="GOCSPX-…"
                className="input-field"
              />
            </div>
          </div>
        </div>

        {/* Default schedule */}
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Default Schedule</h3>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">Default Window Start</label>
              <input
                type="time"
                value={settings.defaultWindowStart || '08:00'}
                onChange={e => update({ defaultWindowStart: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Default Window End</label>
              <input
                type="time"
                value={settings.defaultWindowEnd || '15:00'}
                onChange={e => update({ defaultWindowEnd: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="label">Default Allowed Days</label>
            <div className="flex gap-2 mt-1">
              {ALL_DAYS.map(day => {
                const active = (settings.defaultAllowedDays || []).includes(day)
                return (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={`w-10 h-9 rounded-lg text-xs font-medium transition-colors ${
                      active ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="label">Default Interval (minutes)</label>
            <input
              type="number"
              min="1"
              max="60"
              value={settings.defaultInterval || 5}
              onChange={e => update({ defaultInterval: Number(e.target.value) })}
              className="input-field w-24"
            />
          </div>
        </div>

        {/* Save */}
        {saveMsg && (
          <p className={`text-xs ${saveMsg.includes('saved') ? 'text-green-400' : 'text-red-400'}`}>{saveMsg}</p>
        )}
        <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
