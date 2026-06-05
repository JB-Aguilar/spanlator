function buildJSON(segments, originalContent) {
  try {
    const original = JSON.parse(originalContent)
    const map = {}
    for (const seg of segments) {
      if (seg.key) map[seg.key] = seg.target_text || seg.source_text
    }
    applyJSON(original, '', map)
    return JSON.stringify(original, null, 2)
  } catch {
    return originalContent
  }
}

function applyJSON(obj, prefix, map) {
  if (typeof obj === 'string') {
    return map[prefix] || obj
  } else if (Array.isArray(obj)) {
    obj.forEach((item, i) => { const r = applyJSON(item, `${prefix}[${i}]`, map); if (r !== undefined && typeof item === 'string') obj[i] = r })
  } else if (obj && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      const r = applyJSON(obj[key], prefix ? `${prefix}.${key}` : key, map)
      if (r !== undefined && typeof obj[key] === 'string') obj[key] = r
    }
  }
}

function buildXML(segments, originalContent) {
  const map = {}
  for (const seg of segments) {
    if (seg.key && seg.target_text) {
      if (seg.key.endsWith('.text')) {
        const tag = seg.key.slice(0, -5)
        map[`<${tag}>`] = seg.target_text
      } else {
        map[seg.key] = seg.target_text
      }
    }
  }
  let result = originalContent
  for (const [key, value] of Object.entries(map)) {
    if (key.startsWith('<')) {
      const closing = `</${key.slice(1)}`
      const regex = new RegExp(`(<${key.slice(1, -1)}[^>]*>)[^<]*(</${key.slice(1)})`, 'g')
      result = result.replace(regex, `$1${value}$2`)
    } else {
      const regex = new RegExp(`(${key}=")[^"]*(")`, 'g')
      result = result.replace(regex, `$1${value}$2`)
    }
  }
  return result
}

function buildTXT(segments, originalContent) {
  const lines = originalContent.split(/\r?\n/)
  const result = []
  for (const line of lines) {
    const trimmed = line.trim()
    const seg = segments.find(s => s.source_text === trimmed && s.target_text)
    result.push(seg ? line.replace(trimmed, seg.target_text) : line)
  }
  return result.join('\n')
}

function buildPO(segments, originalContent) {
  const map = {}
  for (const seg of segments) {
    if (seg.source_text && seg.target_text) map[seg.source_text] = seg.target_text
  }
  const blocks = originalContent.split(/\n\n/)
  const result = blocks.map(block => {
    const idMatch = block.match(/msgid\s+"((?:[^"\\]|\\.)*)"/)
    if (idMatch && map[idMatch[1]] !== undefined) {
      return block.replace(/(msgstr\s+")[^"]*(")/, `$1${map[idMatch[1]]}$2`)
    }
    return block
  })
  return result.join('\n\n')
}

function buildOutput(segments, fileType, originalContent) {
  if (fileType === '.json') return buildJSON(segments, originalContent)
  if (fileType === '.xml') return buildXML(segments, originalContent)
  if (fileType === '.txt') return buildTXT(segments, originalContent)
  if (fileType === '.po') return buildPO(segments, originalContent)
  if (['.csv', '.tsv', '.yaml', '.yml'].includes(fileType)) {
    return segments.map(s => s.target_text || s.source_text).join('\n')
  }
  return originalContent
}

module.exports = { buildOutput }
