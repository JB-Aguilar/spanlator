import React, { useState, useEffect } from 'react'
import { t, setLocale, getLocale } from '../i18n'
import { getSettings, updateSettings } from '../api'

export default function SettingsView() {
  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)
  const locale = getLocale()

  useEffect(() => {
    getSettings().then(s => {
      if (s.openai_api_key) setApiKey(s.openai_api_key)
    }).catch(() => {})
  }, [])

  const handleSave = async () => {
    await updateSettings({ openai_api_key: apiKey })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 p-6">
      <div className="max-w-lg w-full mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('settings.title')}</h1>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400">{t('settings.theme')}</label>
          <div className="flex gap-2">
            {['light', 'dark'].map(mode => (
              <button
                key={mode}
                onClick={() => {
                  const isDark = mode === 'dark'
                  document.documentElement.classList.toggle('dark', isDark)
                  localStorage.setItem('sl_theme', mode)
                }}
                className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                  document.documentElement.classList.contains('dark') === (mode === 'dark')
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                }`}
              >
                {t(`settings.${mode}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400">{t('settings.lang')}</label>
          <select
            value={locale}
            onChange={(e) => { setLocale(e.target.value); window.location.reload() }}
            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
          >
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400">{t('settings.api_key')}</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
          />
          <p className="text-xs text-zinc-400">{t('settings.api_key_hint')}</p>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {saved ? '✓' : t('glossary.save')}
          </button>
        </div>

        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <p className="text-xs text-zinc-400">{t('settings.about')}</p>
        </div>
      </div>
    </div>
  )
}
