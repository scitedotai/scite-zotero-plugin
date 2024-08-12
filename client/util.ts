declare const Zotero: any

export const worker = typeof location !== 'undefined' && location.search
export const isZotero7 = worker ? ((new URLSearchParams(location.search)).get('isZotero7') === 'true') : Zotero.platformMajorVersion >= 102

export function htmlencode(text) {
  return `${text}`.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function plaintext(text) {
  return `${text}`
}

export function getField(item, field) {
  try {
    return item.getField(field) || ''
  } catch (err) {
    return ''
  }
}

export function getDOI(doi, extra) {
  if (doi) return doi.toLowerCase().trim()

  if (!extra) return ''

  const dois = extra.split('\n').map(line => line.match(/^DOI:\s*(.+)/i)).filter(line => line).map(line => line[1].trim())
  return dois[0]?.toLowerCase().trim() || ''
}

export function isShortDoi(doi) {
  return doi.match(/10\/[^\s]*[^\s\.,]/)
}
