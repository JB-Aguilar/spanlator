import React, { useState, useRef, useEffect } from 'react'
import { Upload, File, CheckCircle, AlertCircle, Loader2, FolderOpen, History } from 'lucide-react'
import { uploadFile, uploadFilePath, getProject, getProjects } from '../api'
import { t } from '../i18n'
import { cn } from '../lib/utils'

export default function UploadView({ onProjectCreated }) {
  const [file, setFile] = useState(null)
  const [game, setGame] = useState('')
  const [source, setSource] = useState('en')
  const [target, setTarget] = useState('es')
  const [state, setState] = useState('idle')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [recent, setRecent] = useState([])
  const [progress, setProgress] = useState(0)
  const inputRef = useRef(null)
  const pollRef = useRef(null)

  useEffect(() => {
    getProjects().then(setRecent).catch(() => {})
  }, [])

  const langs = [
    { value: 'en', label: t('lang.en') },
    { value: 'es', label: t('lang.es') },
  ]

  const VALID_EXTENSIONS = ['.json', '.xml', '.txt', '.po', '.csv', '.tsv', '.yaml', '.yml']

  const isValidFile = (name) => VALID_EXTENSIONS.some(ext => name.toLowerCase().endsWith(ext))

  const startPoll = (projectId) => {
    setState('translating')
    setProgress(0)
    pollRef.current = setInterval(async () => {
      try {
        const proj = await getProject(projectId)
        if (proj.status === 'ready' || proj.status === 'error') {
          clearInterval(pollRef.current)
          pollRef.current = null
          if (proj.status === 'ready') {
            setState('done')
            setResult(proj)
            setProgress(100)
          } else {
            setState('error')
            setError(t('upload.error'))
          }
          return
        }
        if (proj.total_segments > 0) {
          const translated = proj.segments.filter(s => s.target_text && s.target_text.trim()).length
          setProgress(Math.round((translated / proj.total_segments) * 100))
        }
      } catch {}
    }, 1500)
  }

  const handleSubmit = async () => {
    if (!file) return
    setState('uploading')
    setError('')
    setResult(null)
    try {
      const data = await uploadFile(file, game || file.name.replace(/\.[^.]+$/, ''), source, target)
      startPoll(data.project_id)
    } catch (err) {
      setState('error')
      setError(err.message)
    }
  }

  const handleNativeOpen = async () => {
    if (!window.electronAPI) return
    const filePath = await window.electronAPI.openFileDialog()
    if (!filePath) return
    setState('uploading')
    setError('')
    setResult(null)
    try {
      const data = await uploadFilePath(filePath, game, source, target)
      startPoll(data.project_id)
    } catch (err) {
      setState('error')
      setError(err.message)
    }
  }

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  return (
    <div className="flex-1 flex flex-col min-h-0 p-6 overflow-y-auto">
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-lg space-y-6">
          <h1 className="text-2xl font-semibold tracking-tight">{t('upload.title')}</h1>

          {window.electronAPI && (
            <button
              onClick={handleNativeOpen}
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <FolderOpen size={18} />
              {t('upload.native_open')}
            </button>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-200 dark:border-zinc-800" />
            </div>
            {window.electronAPI && (
              <div className="relative flex justify-center text-xs">
                <span className="bg-zinc-50 dark:bg-zinc-950 px-2 text-zinc-400">{t('upload.or')}</span>
              </div>
            )}
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f && isValidFile(f.name)) setFile(f) }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
              dragOver
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600'
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".json,.xml,.txt,.po,.csv,.tsv,.yaml,.yml"
              className="hidden"
              onChange={(e) => { if (e.target.files[0]) setFile(e.target.files[0]) }}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400">
                <File size={20} />
                <span className="font-medium truncate max-w-[300px]">{file.name}</span>
              </div>
            ) : (
              <div className="text-zinc-400">
                <Upload size={32} className="mx-auto mb-2" />
                <p className="font-medium">{t('upload.drag')}</p>
                <p className="text-sm mt-1">{t('upload.drag_hint')}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-zinc-500 dark:text-zinc-400">{t('upload.game')}</label>
              <input
                value={game}
                onChange={(e) => setGame(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                placeholder="Elden Ring"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium mb-1 text-zinc-500 dark:text-zinc-400">{t('upload.source')}</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                >
                  {langs.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-zinc-500 dark:text-zinc-400">{t('upload.target')}</label>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                >
                  {langs.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {state === 'translating' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <Loader2 size={16} className="animate-spin" />
                {t('upload.translating')} — {progress}%
              </div>
              <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!file || state === 'uploading'}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              {state === 'uploading' && <Loader2 size={18} className="animate-spin" />}
              {state === 'uploading' && t('upload.uploading')}
              {state !== 'uploading' && t('upload.start')}
            </button>
          )}

          {state === 'done' && result && (
            <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-xl flex items-start gap-3 cursor-pointer hover:bg-green-100 dark:hover:bg-green-950/50 transition-colors"
              onClick={() => { if (onProjectCreated) onProjectCreated(result.project_id) }}
            >
              <CheckCircle size={20} className="text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-300">{t('upload.done')}</p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  {t('upload.result', { total: result.total_segments, translated: result.translated, pending: result.pending })}
                </p>
                <p className="text-xs text-green-500 mt-1">{t('upload.click_to_open')}</p>
              </div>
            </div>
          )}

          {state === 'error' && (
            <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl flex items-start gap-3">
              <AlertCircle size={20} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}
        </div>
      </div>

      {recent.length > 0 && (
        <div className="mt-8 max-w-lg mx-auto w-full">
          <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-2 mb-3">
            <History size={14} /> {t('upload.recent')}
          </h3>
          <div className="grid gap-2">
            {recent.slice(0, 5).map(p => (
              <button
                key={p.id}
                disabled={p.status === 'processing'}
                onClick={() => { if (onProjectCreated) onProjectCreated(p.id) }}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors text-left',
                  p.status === 'processing' ? 'opacity-50 cursor-not-allowed' : 'hover:border-zinc-300 dark:hover:border-zinc-700'
                )}
              >
                <File size={16} className="text-zinc-300 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.file_name}</p>
                  <p className="text-xs text-zinc-400">{p.game_name} · {p.source_lang} → {p.target_lang}</p>
                </div>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full shrink-0',
                  p.status === 'ready' && 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
                  p.status === 'processing' && 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
                )}>
                  {p.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
