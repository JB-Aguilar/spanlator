const { translate } = require('google-translate-api-x')
const { getDb } = require('./database')
const { v4: uuidv4 } = require('uuid')

function applyGlossary(text, langPair) {
  const db = getDb()
  const terms = db.prepare('SELECT source, target FROM glossary').all()
  if (!terms.length) return text
  let result = text
  for (const term of terms) {
    const regex = new RegExp(`\\b${escapeRegex(term.source)}\\b`, 'gi')
    result = result.replace(regex, term.target)
  }
  return result
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function translateWithGoogle(text, sourceLang, targetLang) {
  try {
    const result = await translate(text, { from: sourceLang, to: targetLang })
    return result.text || null
  } catch (err) {
    console.error('Google Translate error:', err.message)
    return null
  }
}

async function translateSegment(segment, sourceLang, targetLang, gameId) {
  const { source_text, context, id } = segment

  const db = getDb()
  const tmExact = db.prepare(`
    SELECT target_text FROM translation_memory
    WHERE source_lang = ? AND target_lang = ? AND source_text = ? AND game_id = ?
    LIMIT 1
  `).get(sourceLang, targetLang, source_text, gameId)

  if (tmExact) {
    return { id, source_text, target_text: tmExact.target_text, translated_by: 'tm', confidence: 1.0 }
  }

  const tmGlobal = db.prepare(`
    SELECT target_text FROM translation_memory
    WHERE source_lang = ? AND target_lang = ? AND source_text = ?
    LIMIT 1
  `).get(sourceLang, targetLang, source_text)

  if (tmGlobal) {
    return { id, source_text, target_text: tmGlobal.target_text, translated_by: 'tm', confidence: 1.0 }
  }

  const translatedText = await translateWithGoogle(source_text, sourceLang, targetLang)
  if (!translatedText) {
    return { id, source_text, target_text: '', translated_by: 'pending', confidence: 0 }
  }

  const glossedText = applyGlossary(translatedText, `${sourceLang}-${targetLang}`)

  return { id, source_text, target_text: glossedText, translated_by: glossedText !== translatedText ? 'glossary' : 'google', confidence: 0.85 }
}

async function translateBatch(segments, sourceLang, targetLang, gameId) {
  const db = getDb()
  const results = []

  const sourceTexts = segments.map(s => s.source_text)
  const placeholders = sourceTexts.map(() => '?').join(',')

  const tmGameMap = {}
  const tmGameRows = db.prepare(`
    SELECT source_text, target_text FROM translation_memory
    WHERE source_lang = ? AND target_lang = ? AND game_id = ? AND source_text IN (${placeholders})
  `).all(sourceLang, targetLang, gameId, ...sourceTexts)
  for (const r of tmGameRows) tmGameMap[r.source_text] = r.target_text

  const tmGlobalMap = {}
  const remaining = sourceTexts.filter(t => !tmGameMap[t])
  if (remaining.length > 0) {
    const remainingPlaceholders = remaining.map(() => '?').join(',')
    const tmGlobalRows = db.prepare(`
      SELECT source_text, target_text FROM translation_memory
      WHERE source_lang = ? AND target_lang = ? AND source_text IN (${remainingPlaceholders})
    `).all(sourceLang, targetLang, ...remaining)
    for (const r of tmGlobalRows) tmGlobalMap[r.source_text] = r.target_text
  }

  for (const seg of segments) {
    if (tmGameMap[seg.source_text]) {
      results.push({ id: seg.id, source_text: seg.source_text, target_text: tmGameMap[seg.source_text], translated_by: 'tm', confidence: 1.0 })
    } else if (tmGlobalMap[seg.source_text]) {
      results.push({ id: seg.id, source_text: seg.source_text, target_text: tmGlobalMap[seg.source_text], translated_by: 'tm', confidence: 1.0 })
    } else {
      results.push(null)
    }
  }

  const toTranslate = []
  for (let i = 0; i < results.length; i++) {
    if (results[i] === null) toTranslate.push(i)
  }

  if (toTranslate.length > 0) {
    const CHUNK = 5
    for (let i = 0; i < toTranslate.length; i += CHUNK) {
      const indices = toTranslate.slice(i, i + CHUNK)
      const texts = indices.map(idx => segments[idx].source_text)
      const translatedTexts = await Promise.all(
        texts.map(t => translateWithGoogle(t, sourceLang, targetLang))
      )
      for (let j = 0; j < indices.length; j++) {
        const idx = indices[j]
        const rawText = translatedTexts[j]
        if (rawText) {
          const glossed = applyGlossary(rawText, `${sourceLang}-${targetLang}`)
          results[idx] = {
            id: segments[idx].id,
            source_text: segments[idx].source_text,
            target_text: glossed,
            translated_by: glossed !== rawText ? 'glossary' : 'google',
            confidence: 0.85,
          }
        } else {
          results[idx] = {
            id: segments[idx].id,
            source_text: segments[idx].source_text,
            target_text: '',
            translated_by: 'pending',
            confidence: 0,
          }
        }
      }
      await new Promise(resolve => setImmediate(resolve))
    }
  }

  return results
}

function saveToTranslationMemory(translations, gameId, sourceLang, targetLang) {
  const db = getDb()
  const insert = db.prepare(`
    INSERT INTO translation_memory (id, game_id, source_lang, target_lang, source_text, target_text, similarity)
    VALUES (?, ?, ?, ?, ?, ?, 1.0)
    ON CONFLICT(source_lang, target_lang, source_text) DO UPDATE SET target_text = excluded.target_text
  `)
  const tx = db.transaction((items) => {
    for (const item of items) {
      if (item.target_text && item.target_text.trim()) {
        insert.run(uuidv4(), gameId, sourceLang, targetLang, item.source_text, item.target_text)
      }
    }
  })
  tx(translations)
}

module.exports = { translateBatch, translateSegment, translateWithGoogle, applyGlossary, saveToTranslationMemory }
