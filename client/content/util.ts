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
  }
  catch (err) {
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

export const fetchTallyDataZotero7 = (item, dataKey) => {
  try {
    const sciteTallyFieldName = dataKey.includes('zotero-items') ? dataKey.split('-').slice(-1)[0] : dataKey
    if (!Zotero.Scite.isReady) {
      return '-'
    }
    const doi = getDOI(item.getField('DOI'), item.getField('extra'))
    if (!doi) {
      return 0
    }
    if (!Zotero.Scite.tallies[doi]) {
      return 0
    }
    const tallies = Zotero.Scite.tallies[doi]
    return tallies[sciteTallyFieldName]
  }
  catch (err) {
    Zotero.logError(`[Scite Zotero] Error loading ${dataKey} tally: ${err}`)
    return 0
  }
}

export const fetchTalliesZotero7 = item => {
  try {
    if (!Zotero.Scite.isReady) return {}
    const doi = getDOI(item.getField('DOI'), item.getField('extra'))
    if (!doi || !Zotero.Scite.tallies[doi]) return {}
    return Zotero.Scite.tallies[doi]
  }
  catch (err) {
    Zotero.logError(`Error loading tallies: ${err}`)
    return {}
  }
}
