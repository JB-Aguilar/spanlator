import React, { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, Download, RefreshCw, Search, CheckCircle2, Clock, Bookmark } from 'lucide-react'
import { getProject, updateSegment, retranslateProject, exportProject } from '../api'
import { t } from '../i18n'
import { cn } from '../lib/utils'

const FILTERS = ['all', 'pending', 'done']

export default function EditorView({ projectId, onBack }) {
  const [project, setProject] = useState(null)
  const [segments, setSegments] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [loading, setLoading] = useState(true)

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

  const handleEdit = (seg) => {
    setEditingId(seg.id)
    setEditValue(seg.target_text || '')
  }

  const handleSave = async (id) => {
    await updateSegment(id, { target_text: editValue })
    setEditingId(null)
    load()
  }

  const handleKeyDown = (e, id) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave(id)
    }
    if (e.key === 'Escape') {
      setEditingId(null)
    }
  }

  const handleRetranslate = async () => {
    await retranslateProject(projectId)
    load()
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
              <div key={seg.id} className="px-6 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-5 text-center shrink-0 mt-0.5">{statusIcon(seg)}</div>
                  <div className="flex-1 min-w-0 grid grid-cols-2 gap-4">
                    <div className="text-sm text-zinc-600 dark:text-zinc-400 truncate">{seg.source_text}</div>
                    {editingId === seg.id ? (
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, seg.id)}
                          className="flex-1 px-2 py-1 text-sm bg-white dark:bg-zinc-800 border border-indigo-500 rounded-md outline-none"
                        />
                        <button onClick={() => handleSave(seg.id)} className="text-indigo-600 text-xs font-medium hover:underline">OK</button>
                      </div>
                    ) : (
                      <div
                        onClick={() => handleEdit(seg)}
                        className={cn(
                          'text-sm rounded px-2 py-1 -mx-2 cursor-pointer transition-colors',
                          seg.target_text
                            ? 'text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            : 'text-zinc-400 italic hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        )}
                      >
                        {seg.target_text || t('editor.status_pending')}
                      </div>
                    )}
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
    </div>
  )
}
