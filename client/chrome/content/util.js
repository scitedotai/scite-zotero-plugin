
function htmlencode(text) {
    return `${text}`.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function plaintext(text) {
    return `${text}`
}

function getField(item, field) {
  try {
    return item.getField(field) || ''
  } catch (err) {
    return ''
  }
}

function getDOI(doi, extra) {
  if (doi) return doi.toLowerCase().trim()

  if (!extra) return ''

  const dois = extra.split('\n').map(line => line.match(/^DOI:\s*(.+)/i)).filter(line => line).map(line => line[1].trim())
  return dois[0]?.toLowerCase().trim() || ''
}

function isShortDoi(doi) {
  return doi.match(/10\/[^\s]*[^\s\.,]/)
}

module.exports = {
    htmlencode,
    plaintext,
    getField,
    getDOI,
    isShortDoi
}
