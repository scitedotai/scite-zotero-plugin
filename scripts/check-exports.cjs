// Run the actual, pinned Zotero translators against a synthetic saved snapshot.
// This optional network check does not open Zotero or access a user library.
const assert = require('node:assert/strict')
const vm = require('node:vm')
const { loadPlugin, item } = require('../test/helpers.cjs')

const revision = 'c83003773b65359e41466e1d419b2d1df5512af7'

async function translate(name, input) {
  const url = `https://raw.githubusercontent.com/zotero/translators/${revision}/${encodeURIComponent(name)}.js`
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
  assert.ok(response.ok, `Could not download ${name}: HTTP ${response.status}`)
  const source = await response.text()
  const script = source.replace(/^\{[\s\S]*?\n\}/, '')
  assert.notEqual(script, source, 'Expected a Zotero translator metadata header')
  let output = ''
  const items = [structuredClone(input)]
  const Zotero = {
    nextItem: () => items.shift() || false,
    write: text => { output += text },
    getOption: name => name === 'exportCharset' ? 'UTF-8' : false,
    getHiddenPref: () => false,
    debug() {},
    Utilities: {},
  }
  // This fixture has an explicit citation key and no dates/creators/attachments,
  // so these exporters do not need any Zotero utility functions.
  vm.runInNewContext(`${script}\ndoExport();`, { Zotero, Z: Zotero, ZU: Zotero.Utilities }, { timeout: 5000 })
  return output
}

async function main() {
  const { plugin } = loadPlugin()
  const target = item({ extra: 'Citation Key: scite_export_test\nKeep this note' })
  await plugin.saveTalliesToExtra(target)
  const input = {
    itemType: 'journalArticle',
    uri: 'https://www.zotero.org/users/local/test/items/ABCD1234',
    title: 'Export example',
    DOI: target.fields.DOI,
    extra: target.fields.extra,
    creators: [],
    tags: [],
    attachments: [],
    notes: [],
  }

  const csv = await translate('CSV', input)
  const csvFields = line => Array.from(line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g), match => match[1].replace(/""/g, '"'))
  const [header, row] = csv.trim().split('\n').map(csvFields)
  assert.ok(header.includes('Extra'))
  assert.equal(row[header.indexOf('Extra')], input.extra.replace(/[\r\n]+/g, ' '))
  console.log('CSV: the Extra column preserves the snapshot (newlines become spaces).')

  const bibtex = await translate('BibTeX', input)
  const note = /\tnote = \{([\s\S]*?)\},?\n/.exec(bibtex)?.[1]
  assert.equal(note, input.extra.replace('Citation Key: scite_export_test\n', ''))
  assert.ok(bibtex.includes('@article{scite_export_test,'))
  console.log('BibTeX: the note field preserves the snapshot; these are not separate BibTeX fields.')
  console.log(`Zotero translators revision: ${revision}`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
