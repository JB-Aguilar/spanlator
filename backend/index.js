const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
const { getDb, closeDb, setDataDir } = require('./database')
const routes = require('./routes')

let server = null

function createApp(dataDir) {
  if (dataDir) {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
    setDataDir(dataDir)
  }

  const db = getDb()

  const apiKeyRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('openai_api_key')
  if (apiKeyRow && apiKeyRow.value) {
    process.env.OPENAI_API_KEY = apiKeyRow.value
  }

  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '50mb' }))
  app.use('/api', routes)

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  app.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(500).json({ error: err.message || 'Internal server error' })
  })

  return app
}

function startServer(port = 0, dataDir = null) {
  return new Promise((resolve, reject) => {
    try {
      const uploadsDir = dataDir ? path.join(dataDir, 'uploads') : null
      if (uploadsDir) routes.setUploadDir(uploadsDir)
      const app = createApp(dataDir)
      server = app.listen(port)
      server.on('listening', () => {
        const addr = server.address()
        console.log(`Server on http://localhost:${addr.port}`)
        resolve(addr.port)
      })
      server.on('error', reject)
    } catch (err) {
      reject(err)
    }
  })
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => { closeDb(); server = null; resolve() })
    } else { resolve() }
  })
}

module.exports = { createApp, startServer, stopServer }
