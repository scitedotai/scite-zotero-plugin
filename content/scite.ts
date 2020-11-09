Components.utils.import('resource://gre/modules/AddonManager.jsm')
declare const AddonManager: any

declare const Zotero: IZotero
declare const Components: any

import { patch as $patch$ } from './monkey-patch'
import { debug } from './debug'
import { htmlencode, plaintext, getField } from './util'

interface Tallies {
  doi: string
  contradicting: number
  mentioning: number
  supporting: number
  total: number
  unclassified: number
}

function getDOI(doi, extra) {
  if (doi) return doi

  if (!extra) return ''

  const dois = extra.split('\n').map(line => line.match(/^DOI:\s*(.+)/i)).filter(line => line).map(line => line[1].trim())
  return dois[0] || ''
}

const itemTreeViewWaiting: Record<string, boolean> = {}

function getCellX(tree, row, col, field) {
  if (col.id !== 'zotero-items-column-scite') return ''

  const item = tree.getRow(row).ref

  if (item.isNote() || item.isAttachment()) return ''

  if (Scite.ready.isPending()) { // tslint:disable-line:no-use-before-declare
    const id = `${field}.${item.id}`
    if (!itemTreeViewWaiting[id]) {
      // tslint:disable-next-line:no-use-before-declare
      Scite.ready.then(() => tree._treebox.invalidateCell(row, col))
      itemTreeViewWaiting[id] = true
    }

    switch (field) {
      case 'image':
        return 'chrome://zotero-scite/skin/loading.gif'
      case 'properties':
        return ' scite-state-loading'
      case 'text':
        return ''
    }
  }

  const tallies = Scite.tallies[getDOI(getField(item, 'DOI'), getField(item, 'extra'))]
  if (!tallies) return ''

  switch (field) {
    case 'text':
      return `Supporting (${tallies.supporting}), Disputing (${tallies.contradicting}), Mentioning (${tallies.mentioning})`

    case 'properties':
      return ' scite-state-muted'
  }
}

$patch$(Zotero.ItemTreeView.prototype, 'getCellProperties', original => function Zotero_ItemTreeView_prototype_getCellProperties(row, col, prop) {
  return (original.apply(this, arguments) + getCellX(this, row, col, 'properties')).trim()
})

$patch$(Zotero.ItemTreeView.prototype, 'getCellText', original => function Zotero_ItemTreeView_prototype_getCellText(row, col) {
  if (col.id !== 'zotero-items-column-scite') return original.apply(this, arguments)

  return getCellX(this, row, col, 'text')
})

$patch$(Zotero.Item.prototype, 'getField', original => function Zotero_Item_prototype_getField(field, unformatted, includeBaseMapped) {
  try {
    if (field === 'scite') {
      if (Scite.ready.isPending()) return '' // tslint:disable-line:no-use-before-declare
      const doi = getDOI(getField(this, 'DOI'), getField(this, 'extra'))
      if (!doi || !Scite.tallies[doi]) return ''
      return ' '
    }
  } catch (err) {
    Zotero.logError(`err in scite patched getField: ${err}`)
    return ''
  }

  return original.apply(this, arguments)
})

const ready = Zotero.Promise.defer()

class CScite { // tslint:disable-line:variable-name
  public ready: any = ready.promise
  public tallies: { [DOI: string]: Tallies } = {}
  public uninstalled: boolean = false

  private bundle: any
  private started = false

  constructor() {
    this.bundle = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService).createBundle('chrome://zotero-scite/locale/zotero-scite.properties')
  }

  public async start() {
    alert('checking start...')
    if (this.started) return
    this.started = true

    await Zotero.Schema.schemaUpdatePromise
    await this.refresh()
    ready.resolve(true)

    Zotero.Notifier.registerObserver(this, ['item'], 'Scite', 1)
  }

  public getString(name, params = {}, html = false) {
    if (!this.bundle || typeof this.bundle.GetStringFromName !== 'function') {
      Zotero.logError(`Scite.getString(${name}): getString called before strings were loaded`)
      return name
    }

    let template = name

    try {
      template = this.bundle.GetStringFromName(name)
    } catch (err) {
      Zotero.logError(`Scite.getString(${name}): ${err}`)
    }

    const encode = html ? htmlencode : plaintext
    return template.replace(/{{(.*?)}}/g, (match, param) => encode(params[param] || ''))
  }

  public async getTallies(doi) {
    try {
      const data = await Zotero.HTTP.request('GET', `https://api.scite.ai/tallies/${doi.toLowerCase()}`)
      const tallies = data?.response
      Zotero.logError(`Scite.getTallies(${doi}): ${JSON.stringify(tallies)}`)
      return tallies ? JSON.parse(tallies) : {}
    } catch (err) {
      Zotero.logError(`Scite.getTallies(${doi}): ${err}`)
      alert(err)
    }
  }

  public async get(dois, options: { refresh?: boolean } = {}) {
    const doisToFetch = options.refresh ? dois : dois.filter(doi => !this.tallies[doi])
    if (doisToFetch.length > 500) {   // tslint:disable-line:no-magic-numbers
      alert('Only 500 DOIs allowed')
      return
    }

    if (doisToFetch.length) {
      try {
        const res = await Zotero.HTTP.request('POST', 'https://api.scite.ai', {
          body: JSON.stringify(doisToFetch.map(doi => doi.toLowerCase())),
          responseType: 'json',
          headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        })
        const doiTallies = res?.response ? JSON.parse(res.response) : {}
        for (const doi of Object.keys(doiTallies)) {
          const tallies = doiTallies[doi]
          this.tallies[doi] = {
            ...tallies,
          }
        }
      } catch (err) {
        debug(`Scite.get(${doisToFetch}): ${err}`)
      }
    }

    return dois.map(doi => this.tallies[doi])
  }

  private async refresh() {
    const query = `
      SELECT DISTINCT fields.fieldName, itemDataValues.value
      FROM fields
      JOIN itemData on fields.fieldID = itemData.fieldID
      JOIN itemDataValues on itemData.valueID = itemDataValues.valueID
      WHERE fieldname IN ('extra', 'DOI')
    `.replace(/[\s\n]+/g, ' ').trim()

    let dois = []
    for (const doi of await Zotero.DB.queryAsync(query)) {
      switch (doi.fieldName) {
        case 'extra':
          dois = dois.concat(doi.value.split('\n').map(line => line.match(/^DOI:\s*(.+)/i)).filter(line => line).map(line => line[1].trim()))
          break
        case 'DOI':
          dois.push(doi.value)
          break
      }
    }

    await this.get(dois, { refresh: true })

    setTimeout(this.refresh.bind(this), 24 * 60 * 60 * 1000) // tslint:disable-line:no-magic-numbers
  }

  protected async notify(action, type, ids, extraData) {
    if (type !== 'item' || (action !== 'modify' && action !== 'add')) return

    const dois = []
    for (const item of (await Zotero.Items.getAsync(ids))) {
      const doi = getDOI(getField(item, 'DOI'), getField(item, 'extra'))
      if (doi && !dois.includes(doi)) dois.push(doi)
    }
    if (dois.length) await this.get(dois)
  }
}
const Scite = new CScite // tslint:disable-line:variable-name

// used in zoteroPane.ts
AddonManager.addAddonListener({
  onUninstalling(addon, needsRestart) {
    if (addon.id === 'hi@scite.ai') Scite.uninstalled = true
  },

  onDisabling(addon, needsRestart) { this.onUninstalling(addon, needsRestart) },

  onOperationCancelled(addon, needsRestart) {
    if (addon.id !== 'hi@scite.ai') return null

    // tslint:disable-next-line:no-bitwise
    if (addon.pendingOperations & (AddonManager.PENDING_UNINSTALL | AddonManager.PENDING_DISABLE)) return null

    delete Zotero.Scite.uninstalled
  },
})

export = Scite
