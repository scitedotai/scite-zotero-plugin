declare const Zotero: IZotero
declare const Components: any
declare const ZoteroItemPane: any

import { patch as $patch$ } from './monkey-patch'
import { debug } from './debug'

const xul = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul'

const SciteItemPane = new class { // tslint:disable-line:variable-name
  public item: any = null

  private observer: number = null

  private dom = {
    parser: Components.classes['@mozilla.org/xmlextras/domparser;1'].createInstance(Components.interfaces.nsIDOMParser),
    serializer: Components.classes['@mozilla.org/xmlextras/xmlserializer;1'].createInstance(Components.interfaces.nsIDOMSerializer),
  }

  public async notify(action, type, ids) {
    if (!this.item || !ids.includes(this.item.id)) return

    switch (action) {
      case 'delete':
      case 'trash':
        this.item = null
        break

      case 'add':
      case 'modify':
        break
    }

    await this.refresh()
  }

  public async load() {
    this.observer = Zotero.Notifier.registerObserver(this, ['item'], 'Scite')
  }

  public async unload() {
    Zotero.Notifier.unregisterObserver(this.observer)
  }

  public async refresh() {
    const container = document.getElementById('zotero-editpane-scite')
    for (const hbox of Array.from(container.getElementsByTagNameNS(xul, 'hbox'))) {
      hbox.remove()
    }

    const doi = this.item?.getField('DOI').toLowerCase()

    let summary = Zotero.Scite.getString('itemPane.noTallies')
    const tallies = Zotero.Scite.tallies[doi]
    if (tallies) {
      summary = Zotero.Scite.getString('itemPane.summary', {...tallies, reportLink: `https://scite.ai/reports/${tallies.doi}` }, true)
      summary = `<div xmlns:html="http://www.w3.org/1999/xhtml">${summary}</div>`
      summary = summary.replace(/(<\/?)/g, '$1html:')

      const html = this.dom.parser.parseFromString(summary, 'text/xml')
      for (const a of html.getElementsByTagNameNS('http://www.w3.org/1999/xhtml', 'a')) {
        if (!a.getAttribute('href')) continue

        a.setAttribute('onclick', 'Zotero.launchURL(this.getAttribute("href")); return false;')
        a.setAttribute('style', 'color: blue')
      }
      summary = this.dom.serializer.serializeToString(html)

      debug(`Scite.ZoteroItemPane.refresh: ${JSON.stringify(tallies)}: ${summary}`)
    }

    document.getElementById('zotero-editpane-scite-summary').innerHTML = summary
  }
}

$patch$(ZoteroItemPane, 'viewItem', original => async function(item, mode, index) {
  let sciteIdx = -1

  try {
    SciteItemPane.item = item

    const tabPanels = document.getElementById('zotero-editpane-tabs')
    sciteIdx = Array.from(tabPanels.children).findIndex(child => child.id === 'zotero-editpane-scite-tab')

    SciteItemPane.refresh()
  } catch (err) {
    Zotero.logError(`Scite.ZoteroItemPane.viewItem: ${err}`)
    sciteIdx = -1
  }

  if (index !== sciteIdx) return await original.apply(this, arguments)
})

window.addEventListener('load', event => {
  SciteItemPane.load().catch(err => Zotero.logError(err))
}, false)
window.addEventListener('unload', event => {
  SciteItemPane.unload().catch(err => Zotero.logError(err))
}, false)

delete require.cache[module.id]
