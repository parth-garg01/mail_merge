import React, { useState, useEffect, createContext, useContext } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import ImportSheet from './pages/ImportSheet'
import TemplateEditor from './pages/TemplateEditor'
import ScheduleConfig from './pages/ScheduleConfig'
import CampaignMonitor from './pages/CampaignMonitor'
import Logs from './pages/Logs'
import Settings from './pages/Settings'
import LockScreen from './pages/LockScreen'

export const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

const DEFAULT_WIZARD = {
  sheetData: null,
  sheetPath: '',
  emailColumn: '',
  subjectTemplate: '',
  bodyTemplate: '',
  campaignName: '',
  schedule: {
    startAt: '',
    windowStart: '08:00',
    windowEnd: '15:00',
    allowedDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    intervalMinutes: 5
  }
}

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [activeCampaignId, setActiveCampaignId] = useState(null)
  const [gmailStatus, setGmailStatus] = useState({ authenticated: false, email: null })
  const [wizard, setWizard] = useState(DEFAULT_WIZARD)
  const [isLocked, setIsLocked] = useState(false)

  useEffect(() => {
    window.api?.gmail.status().then(setGmailStatus)
    window.api?.auth.status().then(({ hasPassword }) => {
      if (hasPassword) setIsLocked(true)
    })
  }, [])

  function resetWizard() {
    setWizard(DEFAULT_WIZARD)
  }

  function updateWizard(patch) {
    setWizard(prev => ({ ...prev, ...patch }))
  }

  function navigate(target, campaignId = null) {
    setPage(target)
    if (campaignId) setActiveCampaignId(campaignId)
  }

  const ctx = {
    page, navigate,
    activeCampaignId, setActiveCampaignId,
    gmailStatus, setGmailStatus,
    wizard, updateWizard, resetWizard
  }

  const PAGES = {
    dashboard: Dashboard,
    import: ImportSheet,
    template: TemplateEditor,
    schedule: ScheduleConfig,
    monitor: CampaignMonitor,
    logs: Logs,
    settings: Settings
  }

  const Page = PAGES[page] || Dashboard

  if (isLocked) {
    return <LockScreen onUnlock={() => setIsLocked(false)} />
  }

  return (
    <AppContext.Provider value={ctx}>
      <div className="flex h-screen bg-slate-900 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto min-w-0">
          <Page />
        </main>
      </div>
    </AppContext.Provider>
  )
}
