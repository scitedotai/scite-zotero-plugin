Components.utils.import('resource://gre/modules/AddonManager.jsm')
declare const AddonManager: any

declare const Zotero: IZotero
declare const Components: any

import { patch as $patch$ } from './monkey-patch'
import { debug } from './debug'
import { htmlencode, plaintext, getField } from './util'

interface Tallies {
  doi: string
  disputing: number // NOTE: The API returns contradicting, we map this manually
  mentioning: number
  supporting: number
  total: number
  unclassified: number
}

const shortToLongDOIMap = {}
const longToShortDOIMap = {}

function getDOI(doi, extra) {
  if (doi) return doi.toLowerCase().trim()

  if (!extra) return ''

  const dois = extra.split('\n').map(line => line.match(/^DOI:\s*(.+)/i)).filter(line => line).map(line => line[1].trim())
  return dois[0].toLowerCase().trim() || ''
}

function isShortDoi(doi) {
  return doi.match(/10\/[^\s]*[^\s\.,]/)
}

async function getLongDoi(shortDoi) {
  try {
    if (!shortDoi) {
      return ''
    }
    // If it starts with 10/, it is short
    //  otherwise, treat it as long and just return
    shortDoi = shortDoi.toLowerCase().trim()
    if (!isShortDoi(shortDoi)) {
      // This is probably a long DOI then!
      return shortDoi
    }
    if (shortDoi in shortToLongDOIMap) {
      debug(`shortToLongDOIMap cache hit ${shortDoi}`)
      return shortToLongDOIMap[shortDoi]
    }

    const res = await Zotero.HTTP.request('GET', `https://doi.org/api/handles/${shortDoi}`)
    const doiRes = res?.response ? JSON.parse(res.response).values : []
    const longDoi = (doiRes && doiRes.length && doiRes.length > 1) ? doiRes[1].data.value.toLowerCase().trim() : ''
    if (!longDoi) {
      debug(`Unable to resolve shortDoi ${shortDoi} to longDoi`)
      // I guess just return the shortDoi for now...?
      return shortDoi
    }

    // Use these to minimize API calls and easily go back and forth
    shortToLongDOIMap[shortDoi] = longDoi
    longToShortDOIMap[longDoi] = shortDoi

    debug(`Converted shortDoi (${shortDoi}) to longDoi (${longDoi})`)
    return longDoi
  } catch (err) {
    Zotero.logError(`ERR_getLongDoi(${shortDoi}): ${err}`)
    return shortDoi
  }
}

const itemTreeViewWaiting: Record<string, boolean> = {}

const sciteItemCols = ['zotero-items-column-supporting', 'zotero-items-column-disputing', 'zotero-items-column-mentioning']
function getCellX(tree, row, col, field) {
  if (sciteItemCols.indexOf(col.id) < 0) return ''
  const key = col.id.split('-').pop()

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
        return 'chrome://zotero-scite/skin/loading.jpg'
      case 'properties':
        return ' scite-state-loading'
      case 'text':
        return ''
    }
  }
  const doi = getDOI(getField(item, 'DOI'), getField(item, 'extra'))
  // This will work regardless of whether the doi is short or long, because the
  //   service will store them by both forms if it was originally a shortDOI.
  const tallies = Scite.tallies[doi]
  if (!tallies) {
    debug(`No tallies found for ${doi}`)
  }

  const value = tallies ? tallies[key].toLocaleString() : '-'

  switch (field) {
    case 'text':
      return value

    case 'properties':
      return ` scite-state-${key}`
  }
}

$patch$(Zotero.ItemTreeView.prototype, 'getCellProperties', original => function Zotero_ItemTreeView_prototype_getCellProperties(row, col, prop) {
  return (original.apply(this, arguments) + getCellX(this, row, col, 'properties')).trim()
})

$patch$(Zotero.ItemTreeView.prototype, 'getCellText', original => function Zotero_ItemTreeView_prototype_getCellText(row, col) {
  if (sciteItemCols.indexOf(col.id) < 0) return original.apply(this, arguments)
  return getCellX(this, row, col, 'text')
})

$patch$(Zotero.Item.prototype, 'getField', original => function Zotero_Item_prototype_getField(field, unformatted, includeBaseMapped) {
  try {
    const colID = `zotero-items-column-${field}`
    if (sciteItemCols.indexOf(colID) >= 0) {
      if (Scite.ready.isPending()) return 0 // tslint:disable-line:no-use-before-declare
      const doi = getDOI(getField(this, 'DOI'), getField(this, 'extra'))
      if (!doi || !Scite.tallies[doi]) return 0
      const tallies = Scite.tallies[doi]
      return tallies[field]
    }
  } catch (err) {
    Zotero.logError(`err in scite patched getField: ${err}`)
    return 0
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

  public async viewSciteReport(doi) {
    try {
      if (isShortDoi(doi)) {
        doi = await getLongDoi(doi)
      }
      const zoteroPane = Zotero.getActiveZoteroPane()
      zoteroPane.loadURI(`https://scite.ai/reports/${doi}`)
    } catch (err) {
      Zotero.logError(`Scite.refreshTallies(${doi}): ${err}`)
      alert(err)
    }
  }

  public async refreshTallies(doi) {
    try {
      if (isShortDoi(doi)) {
        doi = await getLongDoi(doi)
      }

      const data = await Zotero.HTTP.request('GET', `https://api.scite.ai/tallies/${doi.toLowerCase().trim()}`)
      const tallies = data?.response
      if (!tallies) {
        Zotero.logError(`Scite.refreshTallies: No tallies found for: (${doi})`)
        return {}
      }
      const tallyData = JSON.parse(tallies)
      this.tallies[doi] = {
        ...tallyData,
        disputing: tallyData.contradicting,
      }
      // Also set it for the short DOI equivalent
      const shortDoi = longToShortDOIMap[doi]
      if (shortDoi) {
        this.tallies[shortDoi] = {
          ...tallyData,
          disputing: tallyData.contradicting,
        }
      }
      return tallyData
    } catch (err) {
      Zotero.logError(`Scite.refreshTallies(${doi}): ${err}`)
      alert(err)
    }
  }

  public async bulkRefreshDois(doisToFetch) {
    try {
      const res = await Zotero.HTTP.request('POST', 'https://api.scite.ai/tallies', {
        body: JSON.stringify(doisToFetch.map(doi => doi.toLowerCase().trim())),
        responseType: 'json',
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
      })
      const doiTallies = res?.response ? res.response.tallies : {}
      for (const doi of Object.keys(doiTallies)) {
        debug(`scite bulk DOI refresh: ${doi}`)
        const tallies = doiTallies[doi]
        this.tallies[doi] = {
          ...tallies,
          disputing: tallies.contradicting,
        }
        // Also set it for the short DOI equivalent if present
        const shortDoi = longToShortDOIMap[doi]
        if (shortDoi) {
          this.tallies[shortDoi] = {
            ...tallies,
            disputing: tallies.contradicting,
          }
        }
      }
    } catch (err) {
      Zotero.logError(`Scite.bulkRefreshDois(${doisToFetch}): ${err}`)
    }
  }

  public async get(dois, options: { refresh?: boolean } = {}) {
    let doisToFetch = options.refresh ? dois : dois.filter(doi => !this.tallies[doi])

    doisToFetch = await Promise.all(doisToFetch.map(async doi => {
      const longDoi = await getLongDoi(doi)
      return longDoi
    }))
    const numDois = doisToFetch.length
    if (!numDois) {
      return
    }
    const MAX_DOI_BATCH_SIZE = 500   // tslint:disable-line:no-magic-numbers
    if (numDois <= MAX_DOI_BATCH_SIZE) {
      await this.bulkRefreshDois(doisToFetch)
    } else {
      // Do them in chunks of MAX_DOI_BATCH_SIZE due to server limits
      const chunks = []
      let i = 0
      while (i < numDois) {
        chunks.push(doisToFetch.slice(i, i += MAX_DOI_BATCH_SIZE))
      }
      chunks.forEach(async chunk => {
        await this.bulkRefreshDois(chunk)
      })
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
    // this list of dois can include a mix of short and long
    if (dois.length) await this.get(dois)
  }
}
const Scite = new CScite // tslint:disable-line:variable-name

// used in zoteroPane.ts
AddonManager.addAddonListener({
  onUninstalling(addon, needsRestart) {
    if (addon.id === 'scite@scite.ai') Scite.uninstalled = true
  },

  onDisabling(addon, needsRestart) { this.onUninstalling(addon, needsRestart) },

  onOperationCancelled(addon, needsRestart) {
    if (addon.id !== 'scite@scite.ai') return null

    // tslint:disable-next-line:no-bitwise
    if (addon.pendingOperations & (AddonManager.PENDING_UNINSTALL | AddonManager.PENDING_DISABLE)) return null

    delete Zotero.Scite.uninstalled
  },
})

export = Scite
