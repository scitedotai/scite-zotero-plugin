import { IZotero } from './typings/global'

Components.utils.import('resource://gre/modules/AddonManager.jsm')

declare const Zotero: IZotero
declare const Components: any

import { debug } from './client/content/debug'
import { htmlencode, plaintext, getField, getDOI, isShortDoi, isZotero7 } from './client/content/util'
import { PLUGIN_ENABLED } from './client/content/config'
import { sciteColumnsZotero7 } from './client/content/columns'
import { sciteItemPaneZotero7 } from './client/content/itemPane'

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
const MAX_DOI_BATCH_SIZE = 500 // tslint:disable-line:no-magic-numbers

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
  }
  catch (err) {
    Zotero.logError(`ERR_getLongDoi(${shortDoi}): ${err}`)
    return shortDoi
  }
}

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
    if (!PLUGIN_ENABLED) {
      Zotero.logError('Scite Zotero plugin is disabled. Aborting!')
      return
    }

    if (!isZotero7) {
      Zotero.logError('This version of the scite plugin only supports Zotero 7 and after, please upgrade or use an older XPI')
      return
    }

    if (this.started) return
    this.started = true

    const columns = sciteColumnsZotero7.map(column => {
      const iconPath = column.iconPath ? rootURI + column.iconPath : null
      return {
        ...column,
        iconPath,
        htmlLabel: iconPath
          ? `<span><img src="${iconPath}" height="10px" width="9px" style="margin-right: 5px;"/> ${column.label}</span>`
          : column.label,
      }
    })

    for (const column of columns) {
      await Zotero.ItemTreeManager.registerColumns(column)
    }
    Zotero.logError('Registered columns')

    const updatedSciteItemPaneZotero7 = {
      ...sciteItemPaneZotero7,
      header: {
        ...sciteItemPaneZotero7.header,
        icon: sciteItemPaneZotero7.header.icon ? rootURI + sciteItemPaneZotero7.header.icon : null,
      },
      sidenav: {
        ...sciteItemPaneZotero7.sidenav,
        icon: sciteItemPaneZotero7.sidenav.icon ? rootURI + sciteItemPaneZotero7.sidenav.icon : null,
      },
    }
    const registeredID = Zotero.ItemPaneManager.registerSection(updatedSciteItemPaneZotero7)
    Zotero.logError(`Registered Scite section: ${registeredID}`)

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
    }
    catch (err) {
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
    }
    catch (err) {
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
    }
    catch (err) {
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
    }
    catch (err) {
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
    }
    else {
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
    }
    catch (err) {
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

if (!Zotero.Scite) {
  Zotero.Scite = (new CScite)
}
