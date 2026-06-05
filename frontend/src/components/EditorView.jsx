import React, { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Download, RefreshCw, Search, CheckCircle2, Clock, Bookmark, Eye, Lightbulb, X } from 'lucide-react'
import { getProject, updateSegment, retranslateProject, exportProject, getProjectPreview, getSegmentSuggestions } from '../api'
import { t } from '../i18n'
import { cn } from '../lib/utils'

const FILTERS = ['all', 'pending', 'done']

export default function EditorView({ projectId, onBack }) {
  const [project, setProject] = useState(null)
  const [segments, setSegments] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState(null)
  const [editSeg, setEditSeg] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      const p = await getProject(projectId)
      setProject(p)
      setSegments(p.segments || [])
    } catch {} finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { load() }, [load])

  const filtered = segments.filter(s => {
    if (filter === 'pending') return !s.target_text
    if (filter === 'done') return s.target_text
    return true
  }).filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.source_text?.toLowerCase().includes(q) || s.target_text?.toLowerCase().includes(q)
  })

  const handleOpenEdit = async (seg) => {
    setEditSeg(seg)
    setEditValue(seg.target_text || '')
    setSuggestions([])
    setSuggestionsLoading(true)
    try {
      const data = await getSegmentSuggestions(seg.id)
      setSuggestions(data.suggestions || [])
    } catch {} finally {
      setSuggestionsLoading(false)
    }
  }

  const handleApplySuggestion = (text) => {
    setEditValue(text)
  }

  const handleSaveEdit = async () => {
    if (!editSeg) return
    try {
      await updateSegment(editSeg.id, { target_text: editValue })
      setEditSeg(null)
      load()
    } catch {}
  }

  const handleRetranslate = async () => {
    try {
      await retranslateProject(projectId)
      load()
    } catch {}
  }

  const handlePreview = async () => {
    try {
      const data = await getProjectPreview(projectId)
      setPreview(data)
    } catch {}
  }

  const statusIcon = (seg) => {
    if (seg.edited) return <Bookmark size={14} className="text-amber-500" />
    if (seg.target_text) return <CheckCircle2 size={14} className="text-green-500" />
    return <Clock size={14} className="text-zinc-400" />
  }

  const statusLabel = (seg) => {
    if (seg.edited) return t('editor.status_tm')
    if (seg.translated_by === 'glossary') return t('editor.status_glossary')
    if (seg.target_text) return t('editor.status_translated')
    return t('editor.status_pending')
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!project) {
    return <div className="flex-1 flex items-center justify-center text-zinc-400">No project found</div>
  }

  const counts = {
    total: segments.length,
    translated: segments.filter(s => s.target_text).length,
    pending: segments.filter(s => !s.target_text).length,
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="flex items-center gap-3 px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-400">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold truncate">{project.file_name}</h1>
          <p className="text-xs text-zinc-400">{project.game_name} · {project.source_lang} → {project.target_lang}</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-400">
          <span>{t('editor.total')}: <strong className="text-zinc-700 dark:text-zinc-300">{counts.total}</strong></span>
          <span>{t('editor.translated')}: <strong className="text-green-600">{counts.translated}</strong></span>
          <span>{t('editor.pending')}: <strong className="text-amber-600">{counts.pending}</strong></span>
        </div>
        <button onClick={handleRetranslate} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-400" title={t('editor.retranslate')}>
          <RefreshCw size={16} />
        </button>
        <button onClick={() => exportProject(projectId)} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-400" title={t('editor.export')}>
          <Download size={16} />
        </button>
        <button onClick={handlePreview} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-400" title={t('editor.preview')}>
          <Eye size={16} />
        </button>
      </header>

      <div className="flex items-center gap-2 px-6 py-2 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <Search size={14} className="text-zinc-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('editor.search')}
          className="flex-1 bg-transparent border-none outline-none text-sm py-1"
        />
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
              filter === f
                ? 'bg-indigo-600 text-white'
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
            )}
          >
            {t(`editor.filter_${f}`)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-zinc-400 text-sm">{t('editor.no_segments')}</div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
            {filtered.map(seg => (
              <div
                key={seg.id}
                onClick={() => handleOpenEdit(seg)}
                className={cn(
                  'px-6 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer',
                  editSeg?.id === seg.id && 'bg-indigo-50 dark:bg-indigo-950/20'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="w-5 text-center shrink-0 mt-0.5">{statusIcon(seg)}</div>
                  <div className="flex-1 min-w-0 grid grid-cols-2 gap-4">
                    <div className="text-sm text-zinc-600 dark:text-zinc-400 truncate">{seg.source_text}</div>
                    <div className={cn(
                      'text-sm rounded px-2 py-1 -mx-2',
                      seg.target_text
                        ? 'text-zinc-900 dark:text-zinc-100'
                        : 'text-zinc-400 italic'
                    )}>
                      {seg.target_text || t('editor.status_pending')}
                    </div>
                  </div>
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full shrink-0',
                    seg.edited && 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
                    !seg.edited && seg.target_text && 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
                    !seg.target_text && 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                  )}>
                    {statusLabel(seg)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editSeg && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={() => setEditSeg(null)}>
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-zinc-400 font-mono truncate">{editSeg.key}</p>
              </div>
              <button onClick={() => setEditSeg(null)} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 shrink-0 ml-3">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div>
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">{t('editor.source')}</label>
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
                  {editSeg.source_text}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">{t('editor.target')}</label>
                <textarea
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault()
                      handleSaveEdit()
                    }
                    if (e.key === 'Escape') {
                      setEditSeg(null)
                    }
                  }}
                  className="w-full h-32 px-3 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm resize-y leading-relaxed"
                />
                <p className="text-xs text-zinc-400 mt-1">{t('editor.save_hint')}</p>
              </div>

              {editSeg.context && (
                <div>
                  <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">{t('editor.context')}</label>
                  <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg text-xs text-zinc-500">{editSeg.context}</div>
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb size={14} className="text-amber-500" />
                  <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t('editor.suggestions')}</span>
                  {suggestionsLoading && <div className="animate-spin w-3 h-3 border border-indigo-600 border-t-transparent rounded-full ml-auto" />}
                </div>
                {suggestions.length === 0 && !suggestionsLoading && (
                  <p className="text-xs text-zinc-400 italic">{t('editor.no_suggestions')}</p>
                )}
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleApplySuggestion(s.text)}
                      className="w-full text-left p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all group"
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{s.label}</span>
                        <span className="text-[10px] text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">{t('editor.click_to_apply')}</span>
                      </div>
                      <p className="text-sm text-zinc-700 dark:text-zinc-300">{s.text}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
              <button
                onClick={() => setEditSeg(null)}
                className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {t('editor.cancel')}
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {t('glossary.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={() => setPreview(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
              <h2 className="font-semibold">{t('editor.preview')}</h2>
              <button onClick={() => setPreview(null)} className="px-3 py-1 text-sm text-zinc-400 hover:text-zinc-600">{t('editor.close')}</button>
            </div>
            <div className="flex-1 grid grid-cols-2 overflow-hidden">
              <div className="overflow-y-auto p-4 border-r border-zinc-200 dark:border-zinc-800">
                <p className="text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">{t('editor.source')} ({project.source_lang})</p>
                <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono text-zinc-700 dark:text-zinc-300">{preview.original}</pre>
              </div>
              <div className="overflow-y-auto p-4">
                <p className="text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">{t('editor.target')} ({project.target_lang})</p>
                <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono text-zinc-700 dark:text-zinc-300">{preview.translated}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
