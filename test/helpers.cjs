const { buildSync } = require('esbuild')
const vm = require('node:vm')
const path = require('node:path')

function bundle(entry) {
  return buildSync({
    absWorkingDir: path.resolve(__dirname, '..'),
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    define: { 'process.env.NODE_ENV': '"production"' },
    write: false,
  }).outputFiles[0].text
}

const pluginCode = bundle('lib.ts')
const extraCode = bundle('client/content/extra.ts')
const paneCode = bundle('client/content/itemPane.jsx')
const retrieved = '2026-01-02T03:04:05.000Z'

function loadPlugin(request = async () => ({ response: metrics() })) {
  const requests = []
  const errors = []
  const Zotero = {
    platformMajorVersion: 128,
    HTTP: {
      request: async (...args) => {
        requests.push(args)
        return request(...args)
      },
    },
    Promise: { defer: () => ({ promise: Promise.resolve(), resolve() {} }) },
    Notifier: { trigger() {} },
    debug() {},
    logError: error => errors.push(error),
  }
  const context = vm.createContext({
    Zotero,
    Components: {
      classes: {
        '@mozilla.org/intl/stringbundle;1': { getService: () => ({ createBundle: () => ({}) }) },
      },
      interfaces: {},
    },
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [retrieved])) }
    },
  })
  const evaluate = code => {
    context.module = { exports: {} }
    vm.runInContext(`(function (module) { ${code}\n})(module)`, context)
    return context.module.exports
  }
  const extra = evaluate(extraCode)
  const pane = evaluate(paneCode).sciteItemPaneZotero7
  evaluate(pluginCode)
  return { Zotero, plugin: Zotero.Scite, extra, pane, requests, errors }
}

function metrics(overrides = {}) {
  return {
    doi: '10.1234/example',
    supporting: 2,
    contradicting: 1,
    mentioning: 6,
    unclassified: 3,
    total: 12,
    citingPublications: 8,
    ...overrides,
  }
}

function item(fields = {}, overrides = {}) {
  return {
    id: 1,
    library: { editable: true, libraryType: 'user' },
    fields: { DOI: '10.1234/example', extra: '', ...fields },
    isRegularItem: () => true,
    isEditable: () => true,
    getField(field) { return this.fields[field] || '' },
    setField(field, value) { this.fields[field] = value },
    async saveTx() { this.saves = (this.saves || 0) + 1 },
    ...overrides,
  }
}

function deferred() {
  let resolve
  const promise = new Promise(yes => { resolve = yes })
  return { promise, resolve }
}

module.exports = { loadPlugin, metrics, item, deferred, retrieved }
