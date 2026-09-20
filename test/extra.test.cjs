const assert = require('node:assert/strict')
const { test } = require('node:test')
const { loadPlugin, metrics, item, deferred, retrieved } = require('./helpers.cjs')

test('stores all API counts, source DOI, and retrieval time without touching other Extra text', () => {
  const { extra } = loadPlugin()
  const original = 'DOI: 10.1234/other\nCitation Key: sample\nScite Supporting Citations: manual\nScite custom: keep\n\nFree text: $1 <tag> Ω\n'
  const updated = extra.updateExtra(original, metrics(), retrieved)
  assert.ok(updated.startsWith(original))
  assert.ok(updated.endsWith([
    '[scite]',
    'Scite DOI: 10.1234/example',
    'Scite Supporting Citations: 2',
    'Scite Contrasting Citations: 1',
    'Scite Mentioning Citations: 6',
    'Scite Unclassified Citations: 3',
    'Scite Total Smart Citations: 12',
    'Scite Citing Publications: 8',
    `Scite Retrieved: ${retrieved}`,
    '[/scite]',
  ].join('\n')))
  assert.equal(extra.updateExtra(updated, metrics(), retrieved), updated)
})

test('updates a single block, retaining surrounding text and unmanaged lines with their line endings', () => {
  const { extra } = loadPlugin()
  const before = 'Keep before\r\n'
  const after = '\r\nKeep after\n\n'
  const initial = '[scite]\r\nScite DOI: old\r\nScite Supporting Citations: 1\nScite Supporting Citations: 9\r\nCustom: leave this\r\n\r\n[/scite]'
  const updated = extra.updateExtra(before + initial + after, metrics(), retrieved)
  assert.ok(updated.startsWith(before))
  assert.ok(updated.endsWith(after))
  assert.ok(updated.includes('Custom: leave this\r\n\r\n'))
  assert.equal(updated.match(/Scite Supporting Citations:/g).length, 1)
  assert.ok(updated.includes('Scite Supporting Citations: 2\n'))
  assert.equal(extra.updateExtra(updated, metrics(), retrieved), updated)
})

test('appends safely with empty Extra, trailing newlines, and CRLF', () => {
  const { extra } = loadPlugin()
  for (const original of ['', 'text', 'text\n', 'text\r\n', 'text\r\n\n']) {
    const updated = extra.updateExtra(original, metrics(), retrieved)
    assert.ok(updated.startsWith(original))
    assert.equal(extra.updateExtra(updated, metrics(), retrieved), updated)
  }
})

test('refuses ambiguous or incomplete blocks', () => {
  const { extra } = loadPlugin()
  for (const original of ['[scite]', '[/scite]', '[/scite]\n[scite]', '[scite]\n[scite]\n[/scite]', '[scite]\n[/scite]\n[scite]\n[/scite]']) {
    assert.throws(() => extra.updateExtra(original, metrics(), retrieved), /incomplete or multiple/)
  }
})

test('normalizes DOI case, resolver URLs, and the DOI label', () => {
  const { extra } = loadPlugin()
  for (const doi of [' 10.1234/EXAMPLE ', 'https://doi.org/10.1234/Example', 'http://dx.doi.org/10.1234/Example', 'DOI: 10.1234/Example']) {
    assert.equal(extra.normalizeDOI(doi), '10.1234/example')
  }
})

test('validates known zero independently from unavailable, malformed, or mismatched metrics', () => {
  const { extra } = loadPlugin()
  const zero = metrics({ supporting: 0, contradicting: 0, mentioning: 0, unclassified: 0, total: 0, citingPublications: 0 })
  assert.equal(extra.parseMetrics(zero, zero.doi).total, 0)
  for (const invalid of [undefined, null, {}, [], { error: 'not found' }, metrics({ doi: '10.1234/other' }), metrics({ doi: undefined })]) {
    assert.throws(() => extra.parseMetrics(invalid, zero.doi), /complete citation metrics/)
  }
  for (const field of ['supporting', 'contradicting', 'mentioning', 'unclassified', 'total', 'citingPublications']) {
    for (const value of [undefined, null, '0', -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => extra.parseMetrics(metrics({ [field]: value }), zero.doi), /complete citation metrics/)
    }
  }
})

test('every save fetches fresh metrics, with repeat saves updating one snapshot', async () => {
  let response = metrics()
  const { plugin, requests } = loadPlugin(async () => ({ response }))
  const target = item({ DOI: ' HTTPS://doi.org/10.1234/EXAMPLE ', extra: 'Existing text' })
  plugin.tallies['10.1234/example'] = metrics({ total: 999 })
  await plugin.saveTalliesToExtra(target)
  assert.equal(requests.length, 1)
  assert.equal(requests[0][0], 'GET')
  assert.equal(requests[0][1], 'https://api.scite.ai/tallies/10.1234%2Fexample')
  assert.equal(requests[0][2].responseType, 'json')
  assert.equal(target.saves, 1)
  assert.ok(target.fields.extra.includes('Scite Total Smart Citations: 12'))
  assert.equal(plugin.tallies['https://doi.org/10.1234/example'].contrasting, 1)
  response = metrics({ supporting: 0 })
  await plugin.saveTalliesToExtra(target)
  assert.equal(requests.length, 2)
  assert.equal(target.fields.extra.match(/\[scite\]/g).length, 1)
  assert.ok(target.fields.extra.includes('Scite Supporting Citations: 0'))
  const saved = target.fields.extra
  await plugin.saveTalliesToExtra(target)
  assert.equal(requests.length, 3)
  assert.equal(target.fields.extra, saved)
  assert.equal(target.saves, 2, 'identical content and retrieval time require no additional save')
})

test('supports DOI in Extra and editable group libraries', async () => {
  const { plugin } = loadPlugin()
  const target = item({ DOI: '', extra: 'DOI: 10.1234/EXAMPLE\nPMID: 123' }, { library: { editable: true, libraryType: 'group' } })
  await plugin.saveTalliesToExtra(target)
  assert.ok(target.fields.extra.startsWith('DOI: 10.1234/EXAMPLE\nPMID: 123\n'))
  assert.equal(target.saves, 1)
})

test('DOI field takes priority over a different DOI in Extra', async () => {
  const { plugin, requests } = loadPlugin()
  const target = item({ extra: 'DOI: 10.1234/other' })
  await plugin.saveTalliesToExtra(target)
  assert.equal(requests[0][1], 'https://api.scite.ai/tallies/10.1234%2Fexample')
  assert.ok(target.fields.extra.startsWith('DOI: 10.1234/other\n'))
})

test('resolves short DOI and checks metrics against the resolved full DOI', async () => {
  const { plugin, requests } = loadPlugin(async (_method, url) => url.includes('doi.org/api/handles')
    ? { response: JSON.stringify({ values: [{}, { data: { value: '10.1234/EXAMPLE' } }] }) }
    : { response: metrics() })
  const target = item({ DOI: '10/abcd' })
  await plugin.saveTalliesToExtra(target)
  assert.equal(requests.length, 2)
  assert.ok(target.fields.extra.includes('Scite DOI: 10.1234/example'))
  assert.equal(plugin.tallies['10/abcd'].total, 12)
})

test('does not save when short DOI resolution fails', async () => {
  const { plugin, requests } = loadPlugin(async () => { throw new Error('Offline') })
  const target = item({ DOI: '10/abcd', extra: 'Existing text' })
  await assert.rejects(plugin.saveTalliesToExtra(target), /resolve a full DOI/)
  assert.equal(requests.length, 1)
  assert.equal(target.fields.extra, 'Existing text')
})

test('rejects noneditable, deleted, unsaved, nonregular, feed, and DOI-less items before any request', async () => {
  const { plugin, requests } = loadPlugin()
  const targets = [
    item({}, { library: { editable: false, libraryType: 'group' } }),
    item({}, { isEditable: () => false }),
    item({}, { deleted: true }),
    item({}, { id: undefined }),
    item({}, { isRegularItem: () => false }),
    item({}, { library: { editable: true, libraryType: 'feed' } }),
    item({ DOI: '' }),
    null,
  ]
  for (const target of targets) {
    assert.equal(plugin.canSaveTalliesToExtra(target), false)
    await assert.rejects(plugin.saveTalliesToExtra(target), /editable library item/)
  }
  assert.equal(requests.length, 0)
})

test('failed requests and invalid payloads preserve the previous snapshot and its timestamp', async () => {
  const original = loadPlugin().extra.updateExtra('Notes', metrics(), '2020-01-01T00:00:00.000Z')
  for (const request of [
    async () => { throw new Error('HTTP 503') },
    async () => { throw new Error('HTTP 404') },
    async () => ({ response: null }),
    async () => ({ response: {} }),
    async () => ({ response: metrics({ total: null }) }),
    async () => ({ response: metrics({ doi: '10.1234/other' }) }),
    async () => ({ response: '{malformed JSON' }),
  ]) {
    const { plugin } = loadPlugin(request)
    const target = item({ extra: original })
    await assert.rejects(plugin.saveTalliesToExtra(target))
    assert.equal(target.fields.extra, original)
    assert.equal(target.saves, undefined)
    assert.equal(plugin.canSaveTalliesToExtra(target), true, 'failed operations release the per-item guard')
  }
})

test('preserves Extra edits made while awaiting the API', async () => {
  const response = deferred()
  const { plugin } = loadPlugin(() => response.promise)
  const target = item({ extra: 'Old text' })
  const saving = plugin.saveTalliesToExtra(target)
  target.fields.extra = 'Edited while fetching\nScite custom: keep'
  response.resolve({ response: metrics() })
  await saving
  assert.ok(target.fields.extra.startsWith('Edited while fetching\nScite custom: keep\n'))
})

test('rechecks DOI and permissions after the request', async () => {
  for (const change of [
    target => { target.fields.DOI = '10.1234/other' },
    target => { target.fields.DOI = '' },
    target => { target.library.editable = false },
    target => { target.deleted = true },
  ]) {
    const response = deferred()
    const { plugin } = loadPlugin(() => response.promise)
    const target = item({ extra: 'Keep' })
    const saving = plugin.saveTalliesToExtra(target)
    change(target)
    response.resolve({ response: metrics() })
    await assert.rejects(saving, /changed while fetching/)
    assert.equal(target.fields.extra, 'Keep')
    assert.equal(target.saves, undefined)
  }
})

test('prevents overlapping saves for the same item across panes', async () => {
  const response = deferred()
  const { plugin, requests } = loadPlugin(() => response.promise)
  const target = item()
  const saving = plugin.saveTalliesToExtra(target)
  assert.equal(plugin.canSaveTalliesToExtra(target), false)
  await assert.rejects(plugin.saveTalliesToExtra(target), /in progress/)
  response.resolve({ response: metrics() })
  await saving
  assert.equal(requests.length, 1)
  assert.equal(plugin.canSaveTalliesToExtra(target), true)
})

test('saveTx failure preserves the stored snapshot while retaining validated counts in both display-cache aliases', async () => {
  const { plugin, extra, requests } = loadPlugin()
  const original = extra.updateExtra('Keep', metrics({ total: 8 }), '2020-01-01T00:00:00.000Z')
  const target = item({ DOI: 'https://doi.org/10.1234/EXAMPLE', extra: original }, {
    async saveTx() {
      // Zotero.DataObject._recoverFromSaveError reloads stored data before rejecting.
      this.fields.extra = original
      throw new Error('Database unavailable')
    },
  })
  plugin.tallies['10.1234/example'] = metrics({ total: 8 })
  plugin.tallies['https://doi.org/10.1234/example'] = metrics({ total: 8 })
  await assert.rejects(plugin.saveTalliesToExtra(target), /Database unavailable/)
  assert.equal(target.fields.extra, original, 'the previous persisted counts and timestamp are retained')
  assert.equal(plugin.tallies['10.1234/example'].total, 12)
  assert.equal(plugin.tallies['10.1234/example'].contrasting, 1)
  assert.equal(plugin.tallies['https://doi.org/10.1234/example'], plugin.tallies['10.1234/example'])
  assert.equal(requests.length, 1)
  assert.equal(plugin.canSaveTalliesToExtra(target), true)
})

test('the item-modify notifier uses the refreshed cache and does not refetch or recursively save', async () => {
  const { plugin, requests, Zotero } = loadPlugin()
  const target = item({}, {
    async saveTx() { await plugin.notify('modify', 'item', [this.id], {}) },
  })
  Zotero.Items = { getAsync: async () => [target] }
  await plugin.saveTalliesToExtra(target)
  assert.equal(requests.length, 1)
})

function paneBody() {
  const controls = {
    '#scite-plugin-save-extra': { dataset: {} },
    '#scite-plugin-save-extra-status': {},
  }
  return {
    controls,
    querySelector: selector => controls[selector],
    ownerDocument: { l10n: { setAttributes: (element, id, args) => Object.assign(element, { message: id, args }) } },
  }
}

test('pane enables explicit saving, shows success, and honors read-only section state', async () => {
  const { pane, requests } = loadPlugin()
  const body = paneBody()
  const target = item()
  const button = body.controls['#scite-plugin-save-extra']
  const status = body.controls['#scite-plugin-save-extra-status']
  pane.onRender({ body, item: target, editable: false })
  assert.equal(button.disabled, true)
  await button.onclick()
  assert.equal(requests.length, 0)
  pane.onRender({ body, item: target, editable: true })
  assert.equal(requests.length, 0, 'rendering alone must not save')
  const saving = button.onclick()
  assert.equal(button.disabled, true)
  assert.equal(status.message, 'scite-zotero-plugin-save-extra-saving')
  await saving
  assert.equal(button.disabled, false)
  assert.equal(status.message, 'scite-zotero-plugin-save-extra-saved')
})

test('pane reports errors without discarding Extra', async () => {
  const { pane, errors } = loadPlugin(async () => { throw new Error('Offline') })
  const body = paneBody()
  const target = item({ extra: 'Keep' })
  pane.onRender({ body, item: target, editable: true })
  await body.controls['#scite-plugin-save-extra'].onclick()
  assert.equal(target.fields.extra, 'Keep')
  assert.equal(body.controls['#scite-plugin-save-extra-status'].message, 'scite-zotero-plugin-save-extra-error')
  assert.equal(errors.length, 1)
})

test('pane reports a failed snapshot save even with fresh cached counts, and a retry fetches again', async () => {
  const { pane, plugin, extra, errors, requests } = loadPlugin()
  const original = extra.updateExtra('Keep', metrics({ total: 8 }), '2020-01-01T00:00:00.000Z')
  const target = item({ extra: original }, {
    async saveTx() {
      this.fields.extra = original
      throw new Error('Database unavailable')
    },
  })
  const body = paneBody()
  const button = body.controls['#scite-plugin-save-extra']
  const status = body.controls['#scite-plugin-save-extra-status']
  pane.onRender({ body, item: target, editable: true })
  await button.onclick()
  assert.equal(target.fields.extra, original)
  assert.equal(plugin.tallies['10.1234/example'].total, 12)
  assert.equal(status.message, 'scite-zotero-plugin-save-extra-error')
  assert.equal(status.args.reason, 'Database unavailable')
  assert.equal(button.disabled, false)
  assert.equal(errors.length, 1)

  target.saveTx = async () => {}
  await button.onclick()
  assert.equal(requests.length, 2, 'retry must fetch again even though the display cache was updated')
  assert.ok(target.fields.extra.includes('Scite Total Smart Citations: 12'))
  assert.ok(target.fields.extra.includes(`Scite Retrieved: ${retrieved}`))
  assert.equal(status.message, 'scite-zotero-plugin-save-extra-saved')
})

test('finishing a request does not change another selected item’s button or status', async () => {
  const response = deferred()
  const { pane } = loadPlugin(() => response.promise)
  const body = paneBody()
  const target = item()
  pane.onRender({ body, item: target, editable: true })
  const saving = body.controls['#scite-plugin-save-extra'].onclick()
  pane.onRender({ body, item: item({}, { id: 2 }), editable: false })
  response.resolve({ response: metrics() })
  await saving
  assert.equal(body.controls['#scite-plugin-save-extra'].disabled, true)
  assert.equal(body.controls['#scite-plugin-save-extra-status'].message, 'scite-zotero-plugin-save-extra-hint')
})

test('finishing a request retains the current section editability after rerendering the same item', async () => {
  const response = deferred()
  const { pane } = loadPlugin(() => response.promise)
  const body = paneBody()
  const target = item()
  pane.onRender({ body, item: target, editable: true })
  const saving = body.controls['#scite-plugin-save-extra'].onclick()
  pane.onRender({ body, item: target, editable: false })
  response.resolve({ response: metrics() })
  await saving
  assert.equal(body.controls['#scite-plugin-save-extra'].disabled, true)
})
