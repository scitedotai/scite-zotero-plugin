
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

module.exports = {
    htmlencode,
    plaintext,
    getField
}