import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import UploadView from './components/UploadView'
import EditorView from './components/EditorView'
import GlossaryView from './components/GlossaryView'
import SettingsView from './components/SettingsView'
import { initApi } from './api'

function getInitialTheme() {
  const stored = localStorage.getItem('sl_theme')
  if (stored) return stored === 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export default function App() {
  const [view, setView] = useState('upload')
  const [projectId, setProjectId] = useState(null)
  const [ready, setReady] = useState(false)
  const [dark, setDark] = useState(getInitialTheme)

  useEffect(() => {
    initApi().then(() => setReady(true))
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const toggleTheme = () => {
    setDark(d => !d)
  }

  if (!ready && window.electronAPI) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <>
      <Sidebar activeView={view} onViewChange={(v) => { setView(v); if (v === 'editor' && !projectId) setView('upload') }} dark={dark} onToggleTheme={toggleTheme} />
      {view === 'upload' && (
        <UploadView onProjectCreated={(id) => { setProjectId(id); setView('editor') }} />
      )}
      {view === 'editor' && projectId && (
        <EditorView projectId={projectId} onBack={() => setView('upload')} />
      )}
      {view === 'glossary' && <GlossaryView />}
      {view === 'settings' && <SettingsView />}
    </>
  )
}
