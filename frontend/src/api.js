let port = 3001

export async function initApi() {
  if (window.electronAPI) {
    try { port = await window.electronAPI.getServerPort() } catch { port = 3001 }
  }
}

function base() {
  return `http://localhost:${port}/api`
}

export async function uploadFile(file, gameName, sourceLang, targetLang) {
  const form = new FormData()
  form.append('file', file)
  form.append('game_name', gameName)
  form.append('source_lang', sourceLang)
  form.append('target_lang', targetLang)
  const res = await fetch(`${base()}/upload`, { method: 'POST', body: form })
  if (!res.ok) throw new Error((await res.json()).error)
  return res.json()
}

export async function getProject(id) {
  const res = await fetch(`${base()}/projects/${id}`)
  if (!res.ok) throw new Error('Not found')
  return res.json()
}

export async function getProjects() {
  const res = await fetch(`${base()}/projects`)
  return res.json()
}

export async function updateSegment(id, data) {
  const res = await fetch(`${base()}/segments/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error((await res.json()).error)
  return res.json()
}

export async function retranslateProject(id) {
  const res = await fetch(`${base()}/projects/${id}/retranslate`, { method: 'POST' })
  if (!res.ok) throw new Error((await res.json()).error)
  return res.json()
}

export async function exportProject(id) {
  const res = await fetch(`${base()}/projects/${id}/export-data`)
  if (!res.ok) throw new Error((await res.json()).error)
  const data = await res.json()
  if (window.electronAPI) {
    const savePath = await window.electronAPI.saveFileDialog(data.defaultName)
    if (!savePath) return
    await fetch(`${base()}/projects/${id}/export-write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: savePath, content: data.content }),
    })
    return
  }
  const blob = new Blob([data.content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = data.defaultName
  a.click()
  URL.revokeObjectURL(url)
}

export async function getGlossary() {
  const res = await fetch(`${base()}/glossary`)
  return res.json()
}

export async function saveGlossary(terms) {
  const res = await fetch(`${base()}/glossary`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ terms }),
  })
  if (!res.ok) throw new Error((await res.json()).error)
  return res.json()
}

export async function getSettings() {
  const res = await fetch(`${base()}/settings`)
  return res.json()
}

export async function updateSettings(settings) {
  const res = await fetch(`${base()}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  return res.json()
}

export async function getProjectPreview(id) {
  const res = await fetch(`${base()}/projects/${id}/preview`)
  return res.json()
}
