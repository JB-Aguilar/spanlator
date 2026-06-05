import React, { useState, useEffect, useRef } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { getGlossary, saveGlossary } from '../api'
import { t } from '../i18n'

export default function GlossaryView() {
  const [terms, setTerms] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newSource, setNewSource] = useState('')
  const [newTarget, setNewTarget] = useState('')
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef(null)

  useEffect(() => {
    return () => { if (savedTimer.current) clearTimeout(savedTimer.current) }
  }, [])

  useEffect(() => {
    getGlossary().then(data => {
      setTerms(data.terms || [])
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const showSaved = () => {
    setSaved(true)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 2500)
  }

  const addTerm = () => {
    if (!newSource.trim() || !newTarget.trim()) return
    setTerms([...terms, { id: Date.now().toString(), source: newSource.trim(), target: newTarget.trim() }])
    setNewSource('')
    setNewTarget('')
  }

  const removeTerm = (id) => {
    setTerms(terms.filter(t => t.id !== id))
  }

  const updateTerm = (id, field, value) => {
    setTerms(terms.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveGlossary(terms.map(({ source, target }) => ({ source, target })))
      const data = await getGlossary()
      setTerms(data.terms || [])
      showSaved()
    } catch {} finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') addTerm()
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 p-6 overflow-y-auto">
      <div className="max-w-3xl w-full mx-auto space-y-6 pb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('glossary.title')}</h1>
          <p className="text-sm text-zinc-400 mt-1">{t('glossary.description')}</p>
        </div>

        {saved && (
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm px-4 py-3 rounded-xl flex items-center gap-2 animate-fade-in">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            {t('glossary.saved')}
          </div>
        )}

        <div className="flex gap-2">
          <input
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('glossary.source')}
            className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
          />
          <input
            value={newTarget}
            onChange={(e) => setNewTarget(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('glossary.target')}
            className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
          />
          <button onClick={addTerm} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
            <Plus size={18} />
          </button>
        </div>

        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          {terms.length === 0 ? (
            <div className="p-8 text-center text-zinc-400 text-sm">{t('glossary.empty')}</div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {terms.map(term => (
                <div key={term.id} className="flex items-center gap-2 px-4 py-2">
                  <input
                    value={term.source}
                    onChange={(e) => updateTerm(term.id, 'source', e.target.value)}
                    className="flex-1 px-2 py-1 bg-transparent border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-indigo-500 rounded-md outline-none text-sm transition-colors"
                  />
                  <span className="text-zinc-300 dark:text-zinc-600 shrink-0">→</span>
                  <input
                    value={term.target}
                    onChange={(e) => updateTerm(term.id, 'target', e.target.value)}
                    className="flex-1 px-2 py-1 bg-transparent border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-indigo-500 rounded-md outline-none text-sm transition-colors"
                  />
                  <button onClick={() => removeTerm(term.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-zinc-400 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 sticky bottom-0 bg-zinc-50 dark:bg-zinc-950 py-3 -mx-6 px-6 border-t border-zinc-200 dark:border-zinc-800">
          <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 text-white rounded-lg text-sm font-medium transition-colors">
            {saving ? '...' : t('glossary.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
