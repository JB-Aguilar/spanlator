const fs = require('fs')

function parseJSON(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const data = JSON.parse(content)
  const segments = []
  walkJSON(data, '', segments)
  return segments
}

function walkJSON(obj, prefix, segments) {
  if (typeof obj === 'string') {
    segments.push({ key: prefix, source_text: obj, context: '' })
  } else if (Array.isArray(obj)) {
    obj.forEach((item, i) => walkJSON(item, `${prefix}[${i}]`, segments))
  } else if (obj && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      walkJSON(obj[key], prefix ? `${prefix}.${key}` : key, segments)
    }
  }
}

function parseXML(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const segments = []
  const attrNames = ['text', 'name', 'title', 'description', 'label', 'caption', 'tooltip', 'value', 'display', 'subtitle', 'hint']
  const skipAttrs = new Set(['id', 'ID', 'Id', 'guid', 'GUID', 'index', 'type', 'class', 'style', 'path', 'icon', 'sprite'])

  const textMatch = content.matchAll(/<([^>\s]+)[^>]*>([^<]+)<\/\1>/g)
  for (const m of textMatch) {
    const tag = m[1].toLowerCase()
    if (['script', 'style', 'code', 'pre'].includes(tag)) continue
    const text = m[2].trim()
    if (text && text.length > 1 && /[a-zA-Z]/.test(text)) {
      segments.push({ key: `${tag}.text`, source_text: text, context: '' })
    }
  }

  const attrMatch = content.matchAll(/<[^>]+\s+([^=]+)="([^"]+)"[^>]*>/g)
  for (const m of attrMatch) {
    const attrName = m[1].trim()
    const attrValue = m[2].trim()
    if (skipAttrs.has(attrName)) continue
    if (attrName.startsWith('xmlns')) continue
    if (/^[-\d.]+$/.test(attrValue)) continue
    if (/^\w+=\w+/.test(attrValue) && /[-0-9]/.test(attrValue)) continue
    if (attrNames.includes(attrName) || !/^[a-z]/i.test(attrName)) {
      if (attrValue && attrValue.length > 1 && /[a-zA-Z]/.test(attrValue)) {
        segments.push({ key: attrName, source_text: attrValue, context: '' })
      }
    }
  }

  return segments
}

function parseTXT(filePath) {
  const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/)
  return lines.filter(l => l.trim()).map((l, i) => ({
    key: `line_${i + 1}`,
    source_text: l.trim(),
    context: ''
  }))
}

function parsePO(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const segments = []
  const msgidRegex = /msgid\s+"((?:[^"\\]|\\.)*)"/g
  const msgstrRegex = /msgstr\s+"((?:[^"\\]|\\.)*)"/g
  const msgs = content.split(/\n\n/)
  for (const block of msgs) {
    const idMatch = block.match(/msgid\s+"((?:[^"\\]|\\.)*)"/)
    if (idMatch && idMatch[1]) {
      segments.push({ key: '', source_text: idMatch[1], context: '' })
    }
  }
  return segments
}

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split(/\r?\n/).filter(l => l.trim())
  const segments = []
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',')
    if (parts[0]) {
      segments.push({ key: `row_${i}`, source_text: parts[0].trim().replace(/^"|"$/g, ''), context: parts[1] ? parts[1].trim().replace(/^"|"$/g, '') : '' })
    }
  }
  return segments
}

function parseTSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split(/\r?\n/).filter(l => l.trim())
  const segments = []
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split('\t')
    if (parts[0]) {
      segments.push({ key: `row_${i}`, source_text: parts[0].trim(), context: parts[1] ? parts[1].trim() : '' })
    }
  }
  return segments
}

function parseYAML(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const segments = []
  const lines = content.split(/\r?\n/)
  for (const line of lines) {
    const m = line.match(/^\s*[^#]+:\s*"(.+)"\s*$/)
    if (m && m[1]) {
      segments.push({ key: line.split(':')[0].trim(), source_text: m[1], context: '' })
      continue
    }
    const m2 = line.match(/^\s*[^#]+:\s*(.+)\s*$/)
    if (m2 && m2[1] && !m2[1].startsWith('{') && !m2[1].startsWith('[') && /[a-zA-Z]/.test(m2[1])) {
      segments.push({ key: line.split(':')[0].trim(), source_text: m2[1].trim(), context: '' })
    }
  }
  return segments
}

function parseFile(filePath, ext) {
  ext = ext.toLowerCase()
  if (ext === '.json') return parseJSON(filePath)
  if (ext === '.xml') return parseXML(filePath)
  if (ext === '.txt') return parseTXT(filePath)
  if (ext === '.po') return parsePO(filePath)
  if (ext === '.csv') return parseCSV(filePath)
  if (ext === '.tsv') return parseTSV(filePath)
  if (ext === '.yaml' || ext === '.yml') return parseYAML(filePath)
  throw new Error(`Unsupported file type: ${ext}`)
}

module.exports = { parseFile }
