import React, { useState } from 'react'

export default function LockScreen({ onUnlock }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  async function handleUnlock(e) {
    e.preventDefault()
    if (!password) return
    setChecking(true)
    setError('')
    const result = await window.api?.auth.unlock(password)
    setChecking(false)
    if (result?.success) {
      onUnlock()
    } else {
      setError('Incorrect password.')
      setPassword('')
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
      <div className="w-80">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-600/20 border border-indigo-600/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 text-indigo-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-100">Smart Mail Merger</h1>
          <p className="text-slate-400 text-sm mt-1">Enter your password to continue</p>
        </div>

        <form onSubmit={handleUnlock} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            placeholder="Password"
            autoFocus
            className="input-field w-full text-center tracking-widest"
          />
          {error && (
            <p className="text-red-400 text-xs text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={checking || !password}
            className="btn-primary w-full"
          >
            {checking ? 'Checking…' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  )
}
