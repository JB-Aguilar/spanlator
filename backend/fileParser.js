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
  const seen = new Set()

  const attrNames = ['text', 'title', 'description', 'label', 'caption', 'tooltip', 'value', 'display', 'subtitle', 'hint']
  const skipAttrs = new Set(['id', 'ID', 'Id', 'guid', 'GUID', 'index', 'type', 'class', 'style', 'path', 'icon', 'sprite', 'name', 'key', 'ref', 'xml:space'])

  const TAG_REGEX = /<(\/?)([^\s>/]+)((?:\s+[^\s>/]+=(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g

  let match
  while ((match = TAG_REGEX.exec(content)) !== null) {
    const isClosing = match[1] === '/'
    const tagName = match[2]
    const attrsStr = match[3]
    const isSelfClosing = match[4] === '/'

    if (['script', 'style', 'code', 'pre'].includes(tagName.toLowerCase())) continue
    if (isClosing) continue

    if (isSelfClosing) {
      extractAttrs(attrsStr, tagName, segments, seen, attrNames, skipAttrs)
      continue
    }

    extractAttrs(attrsStr, tagName, segments, seen, attrNames, skipAttrs)

    const tagStart = match.index
    const openTagEnd = match.index + match[0].length
    const closingTag = `</${tagName}>`

    const rest = content.slice(openTagEnd)
    const closeIdx = rest.indexOf(closingTag)
    if (closeIdx === -1) continue

    let inner = rest.slice(0, closeIdx).trim()
    const cdataMatch = inner.match(/^<!\[CDATA\[(.+?)\]\]>\s*$/)
    if (cdataMatch) inner = cdataMatch[1].trim()
    if (inner && inner.length > 1 && /[a-zA-Z]/.test(inner) && !inner.includes('<')) {
      const uniq = `${tagName}.text:${inner}`
      if (!seen.has(uniq)) {
        seen.add(uniq)
        segments.push({ key: `${tagName}.text`, source_text: inner, context: '' })
      }
    }
  }

  return segments
}

function extractAttrs(attrsStr, tagName, segments, seen, attrNames, skipAttrs) {
  const ATTR_REGEX = /([^\s=/]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  let m
  while ((m = ATTR_REGEX.exec(attrsStr)) !== null) {
    const attrName = m[1]
    const attrValue = (m[2] !== undefined ? m[2] : m[3]).trim()
    if (skipAttrs.has(attrName)) continue
    if (attrName.startsWith('xmlns')) continue
    if (/^[-\d.]+$/.test(attrValue)) continue
    if (/^\w+=\w+/.test(attrValue) && /[-0-9]/.test(attrValue)) continue
    if (attrNames.includes(attrName) || !/^[a-z]/i.test(attrName)) {
      if (attrValue && attrValue.length > 1 && /[a-zA-Z]/.test(attrValue)) {
        const uniq = `${tagName}.@${attrName}:${attrValue}`
        if (!seen.has(uniq)) {
          seen.add(uniq)
          segments.push({ key: attrName, source_text: attrValue, context: '' })
        }
      }
    }
  }
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
  const rawLines = content.split(/\r?\n/)
  const lines = []
  let buffer = ''
  for (const rawLine of rawLines) {
    buffer += (buffer ? '\n' : '') + rawLine
    const quoteCount = (buffer.match(/"/g) || []).length
    if (quoteCount % 2 === 0) {
      if (buffer.trim()) lines.push(buffer)
      buffer = ''
    }
  }
  if (buffer.trim()) lines.push(buffer)

  const segments = []
  for (let i = 1; i < lines.length; i++) {
    const fields = splitCSVLine(lines[i])
    if (fields[0] && fields[1]) {
      segments.push({ key: fields[0], source_text: fields[1], context: fields.slice(2).join(', ') })
    }
  }
  return segments
}

function splitCSVLine(line) {
  const fields = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes
    } else if (line[i] === ',' && !inQuotes) {
      fields.push(current.trim().replace(/^"|"$/g, ''))
      current = ''
    } else {
      current += line[i]
    }
  }
  fields.push(current.trim().replace(/^"|"$/g, ''))
  return fields
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
