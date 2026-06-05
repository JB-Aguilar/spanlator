import React, { useState, useRef, useCallback } from 'react'
import { Upload, File, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { uploadFile, getProject } from '../api'
import { t } from '../i18n'
import { cn } from '../lib/utils'

export default function UploadView({ onProjectCreated }) {
  const [file, setFile] = useState(null)
  const [game, setGame] = useState('')
  const [source, setSource] = useState('en')
  const [target, setTarget] = useState('es')
  const [state, setState] = useState('idle') // idle | uploading | translating | done | error
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)
  const pollRef = useRef(null)

  const langs = [
    { value: 'en', label: t('lang.en') },
    { value: 'es', label: t('lang.es') },
  ]

  const handleFile = useCallback((f) => {
    if (f) setFile(f)
  }, [])

  const startPoll = (projectId) => {
    setState('translating')
    pollRef.current = setInterval(async () => {
      try {
        const proj = await getProject(projectId)
        if (proj.status === 'ready' || proj.status === 'error') {
          clearInterval(pollRef.current)
          pollRef.current = null
          if (proj.status === 'ready') {
            setState('done')
            setResult(proj)
            if (onProjectCreated) onProjectCreated(projectId)
          } else {
            setState('error')
            setError(t('upload.error'))
          }
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

  React.useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-lg space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t('upload.title')}</h1>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
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
            onChange={(e) => handleFile(e.target.files[0])}
          />
          {file ? (
            <div className="flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400">
              <File size={20} />
              <span className="font-medium">{file.name}</span>
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

        <button
          onClick={handleSubmit}
          disabled={!file || state === 'uploading' || state === 'translating'}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
        >
          {(state === 'uploading' || state === 'translating') && <Loader2 size={18} className="animate-spin" />}
          {state === 'uploading' && t('upload.uploading')}
          {state === 'translating' && t('upload.translating')}
          {state !== 'uploading' && state !== 'translating' && t('upload.start')}
        </button>

        {state === 'done' && result && (
          <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-xl flex items-start gap-3">
            <CheckCircle size={20} className="text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-green-800 dark:text-green-300">{t('upload.done')}</p>
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                {result.total_segments} segmentos · {result.translated} traducidos
              </p>
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
  )
}
