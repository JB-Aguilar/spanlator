const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')
const { getDb } = require('./database')
const { parseFile } = require('./fileParser')
const { buildOutput } = require('./outputBuilder')
const { translateBatch, translateWithGoogle, applyGlossary, saveToTranslationMemory } = require('./translator')

const router = express.Router()
let uploadDir = null

function getUploadDir() {
  if (!uploadDir) {
    uploadDir = path.join(__dirname, '..', 'uploads')
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
  }
  return uploadDir
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, getUploadDir()),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
})
const upload = multer({ storage })

router.post('/upload-path', async (req, res) => {
  try {
    const { file_path, game_name, source_lang, target_lang } = req.body
    if (!file_path || !fs.existsSync(file_path)) return res.status(400).json({ error: 'Invalid file path' })

    const db = getDb()
    const gameName = game_name || path.basename(file_path, path.extname(file_path))
    const sourceLang = source_lang || 'en'
    const targetLang = target_lang || 'es'
    const ext = path.extname(file_path)

    let game = db.prepare('SELECT id FROM games WHERE name = ?').get(gameName)
    if (!game) {
      const gameId = uuidv4()
      db.prepare('INSERT INTO games (id, name) VALUES (?, ?)').run(gameId, gameName)
      game = { id: gameId }
    }

    const segments = parseFile(file_path, ext)
    if (segments.length === 0) return res.status(400).json({ error: 'No translatable text found' })

    const originalContent = fs.readFileSync(file_path, 'utf-8')
    const projectId = uuidv4()

    db.prepare(`
      INSERT INTO projects (id, game_id, file_name, file_type, source_lang, target_lang, status, original_content)
      VALUES (?, ?, ?, ?, ?, ?, 'processing', ?)
    `).run(projectId, game.id, path.basename(file_path), ext, sourceLang, targetLang, originalContent)

    const insertSeg = db.prepare(`INSERT INTO segments (id, project_id, key, source_text, context) VALUES (?, ?, ?, ?, ?)`)
    db.transaction((segs) => {
      for (const seg of segs) insertSeg.run(uuidv4(), projectId, seg.key, seg.source_text, seg.context || '')
    })(segments)

    const insertedSegs = db.prepare('SELECT id, key, source_text, context FROM segments WHERE project_id = ?').all(projectId)

    res.json({
      project_id: projectId,
      total_segments: segments.length,
      translated: 0,
      pending: segments.length,
      status: 'processing',
    })

    setImmediate(async () => {
      try {
        const translations = await translateBatch(insertedSegs, sourceLang, targetLang, game.id)
        const updateSeg = db.prepare('UPDATE segments SET target_text = ?, translated_by = ?, confidence = ? WHERE id = ?')
        db.transaction((trans) => { for (const t of trans) updateSeg.run(t.target_text, t.translated_by, t.confidence || 0, t.id) })(translations)
        saveToTranslationMemory(translations, game.id, sourceLang, targetLang)
        db.prepare('UPDATE projects SET status = ? WHERE id = ?').run('ready', projectId)
      } catch (err) {
        console.error('Background translation error:', err)
        db.prepare('UPDATE projects SET status = ? WHERE id = ?').run('error', projectId)
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    const db = getDb()
    const gameName = req.body.game_name || path.basename(req.file.originalname, path.extname(req.file.originalname))
    const sourceLang = req.body.source_lang || 'en'
    const targetLang = req.body.target_lang || 'es'
    const ext = path.extname(req.file.originalname)

    let game = db.prepare('SELECT id FROM games WHERE name = ?').get(gameName)
    if (!game) {
      const gameId = uuidv4()
      db.prepare('INSERT INTO games (id, name) VALUES (?, ?)').run(gameId, gameName)
      game = { id: gameId }
    }

    const segments = parseFile(req.file.path, ext)
    if (segments.length === 0) {
      fs.unlinkSync(req.file.path)
      return res.status(400).json({ error: 'No translatable text found' })
    }

    const originalContent = fs.readFileSync(req.file.path, 'utf-8')
    const projectId = uuidv4()

    db.prepare(`
      INSERT INTO projects (id, game_id, file_name, file_type, source_lang, target_lang, status, original_content)
      VALUES (?, ?, ?, ?, ?, ?, 'processing', ?)
    `).run(projectId, game.id, req.file.originalname, ext, sourceLang, targetLang, originalContent)

    const insertSeg = db.prepare(`
      INSERT INTO segments (id, project_id, key, source_text, context)
      VALUES (?, ?, ?, ?, ?)
    `)
    db.transaction((segs) => {
      for (const seg of segs) insertSeg.run(uuidv4(), projectId, seg.key, seg.source_text, seg.context || '')
    })(segments)

    const insertedSegs = db.prepare('SELECT id, key, source_text, context FROM segments WHERE project_id = ?').all(projectId)

    res.json({
      project_id: projectId,
      total_segments: segments.length,
      translated: 0,
      pending: segments.length,
      status: 'processing',
    })

    setImmediate(async () => {
      try {
        const translations = await translateBatch(insertedSegs, sourceLang, targetLang, game.id)
        const updateSeg = db.prepare('UPDATE segments SET target_text = ?, translated_by = ?, confidence = ? WHERE id = ?')
        db.transaction((trans) => {
          for (const t of trans) updateSeg.run(t.target_text, t.translated_by, t.confidence || 0, t.id)
        })(translations)
        saveToTranslationMemory(translations, game.id, sourceLang, targetLang)
        db.prepare('UPDATE projects SET status = ? WHERE id = ?').run('ready', projectId)
      } catch (err) {
        console.error('Background translation error:', err)
        db.prepare('UPDATE projects SET status = ? WHERE id = ?').run('error', projectId)
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

router.get('/projects/:id', (req, res) => {
  const db = getDb()
  const project = db.prepare(`
    SELECT p.*, g.name as game_name FROM projects p
    JOIN games g ON p.game_id = g.id
    WHERE p.id = ?
  `).get(req.params.id)

  if (!project) return res.status(404).json({ error: 'Not found' })

  const segments = db.prepare(`
    SELECT id, key, source_text, target_text, context, translated_by, edited, confidence
    FROM segments WHERE project_id = ?
    ORDER BY created_at ASC
  `).all(req.params.id)

  res.json({ ...project, segments })
})

router.get('/projects', (req, res) => {
  const db = getDb()
  const projects = db.prepare(`
    SELECT p.*, g.name as game_name FROM projects p
    JOIN games g ON p.game_id = g.id
    ORDER BY p.created_at DESC
  `).all()
  res.json(projects)
})

router.put('/segments/:id', (req, res) => {
  const db = getDb()
  const { target_text } = req.body
  const seg = db.prepare('SELECT * FROM segments WHERE id = ?').get(req.params.id)
  if (!seg) return res.status(404).json({ error: 'Not found' })

  db.prepare("UPDATE segments SET target_text = ?, translated_by = 'manual', edited = 1 WHERE id = ?")
    .run(target_text, req.params.id)

  const updated = db.prepare('SELECT * FROM segments WHERE id = ?').get(req.params.id)

  const project = db.prepare('SELECT game_id, source_lang, target_lang FROM projects WHERE id = ?').get(seg.project_id)
  if (project) {
    saveToTranslationMemory(
      [{ source_text: updated.source_text, target_text: updated.target_text }],
      project.game_id, project.source_lang, project.target_lang
    )
  }

  res.json(updated)
})

router.get('/segments/:id/suggestions', async (req, res) => {
  try {
    const db = getDb()
    const seg = db.prepare('SELECT * FROM segments WHERE id = ?').get(req.params.id)
    if (!seg) return res.status(404).json({ error: 'Not found' })

    const project = db.prepare('SELECT game_id, source_lang, target_lang FROM projects WHERE id = ?').get(seg.project_id)
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const suggestions = []

    const tmGame = db.prepare(`
      SELECT target_text FROM translation_memory
      WHERE source_lang = ? AND target_lang = ? AND source_text = ? AND game_id = ?
      LIMIT 1
    `).get(project.source_lang, project.target_lang, seg.source_text, project.game_id)

    if (tmGame) {
      suggestions.push({ source: 'tm_game', label: 'Translation Memory (this game)', text: tmGame.target_text })
    }

    const tmGlobal = db.prepare(`
      SELECT target_text FROM translation_memory
      WHERE source_lang = ? AND target_lang = ? AND source_text = ? AND game_id != ?
      LIMIT 1
    `).get(project.source_lang, project.target_lang, seg.source_text, project.game_id)

    if (tmGlobal) {
      suggestions.push({ source: 'tm_global', label: 'Translation Memory (other games)', text: tmGlobal.target_text })
    }

    const glossaryTerms = db.prepare(`
      SELECT source, target FROM glossary
      WHERE ? LIKE '%' || source || '%'
    `).all(seg.source_text)

    for (const term of glossaryTerms) {
      suggestions.push({ source: 'glossary', label: `Glossary: "${term.source}"`, text: term.target })
    }

    const googleText = await translateWithGoogle(seg.source_text, project.source_lang, project.target_lang)
    if (googleText) {
      const glossed = applyGlossary(googleText, `${project.source_lang}-${project.target_lang}`)
      suggestions.push({ source: 'google', label: 'Google Translate', text: glossed || googleText })
    }

    res.json({ suggestions })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

router.post('/projects/:id/retranslate', async (req, res) => {
  try {
    const db = getDb()
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
    if (!project) return res.status(404).json({ error: 'Not found' })

    const segments = db.prepare(`
      SELECT id, key, source_text, context FROM segments
      WHERE project_id = ? AND edited = 0
    `).all(req.params.id)

    if (segments.length === 0) return res.json({ message: 'No segments to retranslate' })

    const translations = await translateBatch(segments, project.source_lang, project.target_lang, project.game_id)
    const updateSeg = db.prepare('UPDATE segments SET target_text = ?, translated_by = ?, confidence = ? WHERE id = ?')
    db.transaction((trans) => {
      for (const t of trans) updateSeg.run(t.target_text, t.translated_by, t.confidence || 0, t.id)
    })(translations)

    saveToTranslationMemory(translations, project.game_id, project.source_lang, project.target_lang)
    res.json({ retranslated: translations.length, status: 'ok' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/projects/:id/export-data', (req, res) => {
  try {
    const db = getDb()
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
    if (!project) return res.status(404).json({ error: 'Not found' })

    const segments = db.prepare('SELECT key, source_text, target_text FROM segments WHERE project_id = ? ORDER BY created_at ASC').all(req.params.id)
    const output = buildOutput(segments, project.file_type, project.original_content)
    const exportName = project.file_name.replace(/\.[^.]+$/, `_${project.target_lang}$&`)
    res.json({ content: output, defaultName: exportName })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/projects/:id/export-write', (req, res) => {
  try {
    const { path: savePath, content } = req.body
    fs.writeFileSync(savePath, content || '')
    res.json({ saved: savePath })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/projects/:id/preview', (req, res) => {
  try {
    const db = getDb()
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
    if (!project) return res.status(404).json({ error: 'Not found' })

    const segments = db.prepare('SELECT key, source_text, target_text FROM segments WHERE project_id = ? ORDER BY created_at ASC').all(req.params.id)
    const translated = buildOutput(segments, project.file_type, project.original_content)
    res.json({ original: project.original_content, translated, file_type: project.file_type })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/glossary', (req, res) => {
  const db = getDb()
  const terms = db.prepare('SELECT id, source, target FROM glossary ORDER BY created_at ASC').all()
  res.json({ terms })
})

router.put('/glossary', (req, res) => {
  const db = getDb()
  const { terms } = req.body
  db.transaction(() => {
    db.prepare('DELETE FROM glossary').run()
    const insert = db.prepare('INSERT INTO glossary (id, source, target) VALUES (?, ?, ?)')
    for (const term of terms || []) {
      if (term.source && term.target) insert.run(uuidv4(), term.source, term.target)
    }
  })()
  res.json({ status: 'ok', count: (terms || []).length })
})

router.get('/settings', (req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT key, value FROM settings').all()
  const settings = {}
  for (const r of rows) settings[r.key] = r.value
  res.json(settings)
})

router.put('/settings', (req, res) => {
  const db = getDb()
  const { openai_api_key } = req.body
  if (openai_api_key !== undefined) {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('openai_api_key', openai_api_key)
    process.env.OPENAI_API_KEY = openai_api_key || ''
  }
  res.json({ status: 'ok' })
})

module.exports = router
module.exports.setUploadDir = (dir) => { uploadDir = dir }
