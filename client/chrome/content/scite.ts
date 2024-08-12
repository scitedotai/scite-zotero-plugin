import { IZotero } from '../../../typings/global';

Components.utils.import('resource://gre/modules/AddonManager.jsm')

declare const AddonManager: any
declare const Zotero: IZotero
declare const Components: any
declare const ZoteroPane: any

import { patch as $patch$ } from './monkey-patch'
import { debug } from './debug'
import { htmlencode, plaintext, getField, getDOI, isShortDoi } from './util'
import { PLUGIN_ENABLED } from './config'
import { sciteColumns, sciteColumnsZotero7 } from './headers'
import { isZotero7 } from './client'

interface Tallies {
  doi: string
  contrasting: number // NOTE: The API returns contradicting, we map this manually
  mentioning: number
  supporting: number
  total: number
  unclassified: number
  citingPublications: number
}

const shortToLongDOIMap = {}
const longToShortDOIMap = {}
const usingXULTree = typeof Zotero.ItemTreeView !== 'undefined'
const MAX_DOI_BATCH_SIZE = 500   // tslint:disable-line:no-magic-numbers

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

const sciteItemCols = new Set(['zotero-items-column-supporting', 'zotero-items-column-contrasting', 'zotero-items-column-mentioning', 'zotero-items-column-total', 'zotero-items-column-citingPublications'])

function getCellX(tree, row, col, field) {
  if (usingXULTree && !sciteItemCols.has(col.id)) return ''
  if (!usingXULTree && !sciteItemCols.has(col.dataKey)) return ''

  const key = usingXULTree ? col.id.split('-').pop() : col.dataKey.split('-').pop()

  const item = tree.getRow(row).ref

  if (item.isNote() || item.isAttachment()) return ''

  if (Scite.ready.isPending()) { // tslint:disable-line:no-use-before-declare

    const id = `${field}.${item.id}`
    if (!itemTreeViewWaiting[id]) {
      // tslint:disable-next-line:no-use-before-declare
      if (usingXULTree) {
        Scite.ready.then(() => tree._treebox.invalidateCell(row, col))
      } else {
        Scite.ready.then(() => tree.tree.invalidateRow(row))
      }
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

if (PLUGIN_ENABLED) {
  if (usingXULTree) {
    /**
     * Backwards compatibility for the old XUL based tree, see:
     * - https://github.com/scitedotai/scite-zotero-plugin/pull/26
     * - https://groups.google.com/g/zotero-dev/c/yi4olucA_vY/m/pTY4QCzTAQAJ?pli=1
     */
    $patch$(Zotero.ItemTreeView.prototype, 'getCellProperties', original => function Zotero_ItemTreeView_prototype_getCellProperties(row, col, prop) {
      return (original.apply(this, arguments) + getCellX(this, row, col, 'properties')).trim()
    })

    $patch$(Zotero.ItemTreeView.prototype, 'getCellText', original => function Zotero_ItemTreeView_prototype_getCellText(row, col) {
      if (!sciteItemCols.has(col.id)) return original.apply(this, arguments)
      return getCellX(this, row, col, 'text')
    })

  } else {
    if (!isZotero7) {
      /**
       * If using a newer version of Zotero with HTML tree,
       *  patch using itemTree instead of itemTreeView.
       */
      const itemTree = require('zotero/itemTree')
      $patch$(itemTree.prototype, 'getColumns', original => function Zotero_ItemTree_prototype_getColumns() {
        const columns = original.apply(this, arguments)
        const insertAfter = columns.findIndex(column => column.dataKey === 'title')
        columns.splice(insertAfter + 1, 0, ...sciteColumns)
        return columns
      })

      $patch$(itemTree.prototype, '_renderCell', original => function Zotero_ItemTree_prototype_renderCell(index, data, column) {
        if (!sciteItemCols.has(column.dataKey)) return original.apply(this, arguments)

        if (Scite.ready.isPending()) {
          const loadingIcon = document.createElementNS('http://www.w3.org/1999/xhtml', 'span')
          loadingIcon.className = 'zotero-items-column-loading icon icon-bg cell-icon'

          const loadingSpan = document.createElementNS('http://www.w3.org/1999/xhtml', 'span')
          loadingSpan.className = `cell ${column.className} scite-cell`

          loadingSpan.append(loadingIcon)
          return loadingSpan
        }

        const textSpan = document.createElementNS('http://www.w3.org/1999/xhtml', 'span')
        textSpan.className = 'cell-text'
        textSpan.innerText = data

        const span = document.createElementNS('http://www.w3.org/1999/xhtml', 'span')
        span.className = `cell ${column.className} scite-cell`

        span.append(textSpan)
        return span
      })
    }
  }
}

$patch$(Zotero.Item.prototype, 'getField', original => function Zotero_Item_prototype_getField(field, unformatted, includeBaseMapped) {
  if (typeof field !== 'string') {
    return original.apply(this, arguments)
  }

  // NOTE (Ashish):
  // In Zotero 5, the field was just e.g. 'supporting', 'mentioning', etc.
  // To support older versions that use the XUL tree, we have to construct it manually.
  // In Zotero 6, it comes as 'zotero-items-colum-supporting', which means we do not need to
  //   construct it manually.
  const zoteroColID = field.includes('zotero-items') ? field : `zotero-items-column-${field.split('-').slice(-1)[0]}`
  const sciteTallyFieldName = field.includes('zotero-items') ? field.split('-').slice(-1)[0] : field

  try {
    // This try / catch is intentionally here to only
    //    cover / swallow the exception & return 0 for
    //    scite specific columns.
    if (sciteItemCols.has(zoteroColID)) {
      if (Scite.ready.isPending()) return '-' // tslint:disable-line:no-use-before-declare
      const doi = getDOI(getField(this, 'DOI'), getField(this, 'extra'))
      if (!doi || !Scite.tallies[doi]) return 0
      const tallies = Scite.tallies[doi]
      return tallies[sciteTallyFieldName]
    }
  } catch (err) {
    Zotero.logError(`err in scite patched getField: ${err}`)
    return 0
  }

  return original.apply(this, arguments)
})

const ready = Zotero.Promise.defer()

export class CScite {
  public ready: any = ready.promise
  public tallies: { [DOI: string]: Tallies } = {}
  public uninstalled: boolean = false

  private bundle: any
  private started = false

  constructor() {
    this.bundle = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService).createBundle('chrome://zotero-scite/locale/zotero-scite.properties')
  }

  public async start(rootURI: string = '') {
    if (this.started) return
    this.started = true

    if (isZotero7) {
      Zotero.logError('registering columns')
      const columns = sciteColumnsZotero7.map(column => {
        const iconPath = column.iconPath ? rootURI + column.iconPath : null;
        return {
          ...column,
          iconPath,
          htmlLabel: iconPath
            ? `<span><img src="${iconPath}" height="10px" width="9px" style="margin-right: 5px;"/> ${column.label}</span>`
            : column.label,
        };
      });

      for (const column of columns) {
        await Zotero.ItemTreeManager.registerColumns(column)
      }
      Zotero.logError('registered columns')
    }
    await Zotero.Schema.schemaUpdatePromise

    await this.refresh()
    ready.resolve(true)
    Zotero.Notifier.registerObserver(this, ['item'], 'Scite', 1)

    if (!isZotero7) {
      if (!usingXULTree) {
        $patch$(Zotero.getActiveZoteroPane().itemsView, '_getRowData', original => function Zotero_ItemTree_prototype_getRowData(index) {
          const row = original.apply(this, arguments)
          for (const column of sciteColumns) {
            row[column.dataKey] = getCellX(this, index, column, 'text')
          }
          return row
        })
      }

      if (!usingXULTree) ZoteroPane.itemsView.refreshAndMaintainSelection()
    }
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
      Zotero.logError(`Scite.viewSciteReport(${doi}): ${err}`)
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
        contrasting: tallyData.contradicting,
      }
      // Also set it for the short DOI equivalent
      const shortDoi = longToShortDOIMap[doi]
      if (shortDoi) {
        this.tallies[shortDoi] = {
          ...tallyData,
          contrasting: tallyData.contradicting,
        }
      }
      return tallyData
    } catch (err) {
      Zotero.logError(`Scite.refreshTallies(${doi}): ${err}`)
      alert(err)
    }
  }

  public async bulkRefreshDois(doisToFetch) {
    if (!doisToFetch) {
      return
    }

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
          contrasting: tallies.contradicting,
        }
        // Also set it for the short DOI equivalent if present
        const shortDoi = longToShortDOIMap[doi]
        if (shortDoi) {
          this.tallies[shortDoi] = {
            ...tallies,
            contrasting: tallies.contradicting,
          }
        }
      }
    } catch (err) {
      Zotero.logError(`Scite.bulkRefreshDois error getting ${doisToFetch.length || 0} DOIs: ${err}`)
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
    if (numDois <= MAX_DOI_BATCH_SIZE) {
      await this.bulkRefreshDois(doisToFetch)
    } else {
      // Do them in chunks of MAX_DOI_BATCH_SIZE due to server limits
      const chunks = []
      let i = 0
      while (i < numDois) {
        chunks.push(doisToFetch.slice(i, i += MAX_DOI_BATCH_SIZE))
      }

      // Properly wait for each chunk to finish before returning!
      await chunks.reduce(async (promise, chunk) => {
        await promise
        await this.bulkRefreshDois(chunk)
      }, Promise.resolve())
    }
    return dois.map(doi => this.tallies[doi])
  }

  private async refresh() {
    try {
      const query = `
        SELECT DISTINCT fields.fieldName, itemDataValues.value
        FROM fields
        JOIN itemData on fields.fieldID = itemData.fieldID
        JOIN itemDataValues on itemData.valueID = itemDataValues.valueID
        WHERE fieldname IN ('extra', 'DOI')
      `.replace(/[\s\n]+/g, ' ').trim()

      let dois = []
      // eslint-disable-next-line
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
      setTimeout(this.refresh.bind(this), 24 * 60 * 60 * 1000) // eslint-disable-line no-magic-numbers
    } catch (err) {
      Zotero.logError('[Scite Zotero] Unexpected error refreshing tallies')
      Zotero.logError(err)
      throw err
    }
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
const Scite = new CScite

// used in zoteroPane.ts
AddonManager.addAddonListener({
  onUninstalling(addon, needsRestart) {
    if (addon.id === 'scite@scite.ai') Scite.uninstalled = true
  },

  onDisabling(addon, needsRestart) { this.onUninstalling(addon, needsRestart) },

  onOperationCancelled(addon, needsRestart) {
    if (addon.id !== 'scite@scite.ai') return null

    // eslint-disable-next-line no-bitwise
    if (addon.pendingOperations & (AddonManager.PENDING_UNINSTALL | AddonManager.PENDING_DISABLE)) return null

    delete Zotero.Scite.uninstalled
  },
})

export default Scite
