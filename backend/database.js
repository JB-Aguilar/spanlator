const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

let db
let dataDir = null

function setDataDir(dir) { dataDir = dir }

function getDbPath() {
  if (dataDir) return path.join(dataDir, 'spanlator.db')
  const appData = process.env.APPDATA || path.join(require('os').homedir(), '.local', 'share')
  const dir = path.join(appData, 'SpanLator', 'data')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, 'spanlator.db')
}

function getDb() {
  if (!db) {
    const dbPath = getDbPath()
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    initSchema()
  }
  return db
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      source_lang TEXT NOT NULL DEFAULT 'en',
      target_lang TEXT NOT NULL DEFAULT 'es',
      status TEXT DEFAULT 'pending',
      original_content TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (game_id) REFERENCES games(id)
    );

    CREATE TABLE IF NOT EXISTS segments (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      key TEXT,
      source_text TEXT NOT NULL,
      target_text TEXT DEFAULT '',
      context TEXT DEFAULT '',
      translated_by TEXT DEFAULT 'pending',
      edited INTEGER DEFAULT 0,
      confidence REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS translation_memory (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      source_lang TEXT NOT NULL,
      target_lang TEXT NOT NULL,
      source_text TEXT NOT NULL,
      target_text TEXT NOT NULL,
      similarity REAL DEFAULT 1.0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (game_id) REFERENCES games(id)
    );

    CREATE INDEX IF NOT EXISTS idx_tm_lookup
      ON translation_memory(source_lang, target_lang, source_text);

    CREATE TABLE IF NOT EXISTS glossary (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      target TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  const initSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  initSetting.run('openai_api_key', '')
  initSetting.run('openai_model', 'gpt-4o-mini')

  try { db.exec(`ALTER TABLE segments ADD COLUMN confidence REAL DEFAULT 0`) } catch {}
  try { db.exec(`ALTER TABLE projects ADD COLUMN original_content TEXT DEFAULT ''`) } catch {}
}

function closeDb() {
  if (db) { db.close(); db = null }
}

module.exports = { getDb, closeDb, setDataDir, getDbPath }
