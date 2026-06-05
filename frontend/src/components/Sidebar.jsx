import React from 'react'
import { Upload, FileEdit, BookOpen, Settings, Sun, Moon } from 'lucide-react'
import { t, getLocale, setLocale } from '../i18n'
import { cn } from '../lib/utils'

const nav = [
  { id: 'upload', icon: Upload, label: 'nav.upload' },
  { id: 'editor', icon: FileEdit, label: 'nav.editor' },
  { id: 'glossary', icon: BookOpen, label: 'nav.glossary' },
  { id: 'settings', icon: Settings, label: 'nav.settings' },
]

export default function Sidebar({ activeView, onViewChange, dark, onToggleTheme }) {
  return (
    <aside className="w-14 flex flex-col items-center py-3 gap-1 bg-zinc-100 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 shrink-0">
      <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-bold mb-2">
        S
      </div>

      {nav.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => onViewChange(id)}
          title={t(label)}
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
            activeView === id
              ? 'bg-indigo-600 text-white'
              : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
          )}
        >
          <Icon size={20} />
        </button>
      ))}

      <div className="flex-1" />

      <button
        onClick={onToggleTheme}
        className="w-10 h-10 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
        title={dark ? 'Light mode' : 'Dark mode'}
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </aside>
  )
}
