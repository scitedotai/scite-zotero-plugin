declare const Zotero: IZotero

import { patch as $patch$ } from './monkey-patch'

const SciteZoteroPane = new class { // tslint:disable-line:variable-name
  private selectedItem: any

  public async load() {
    document.getElementById('zotero-itemmenu').addEventListener('popupshowing', this, false)

    await Zotero.Scite.start()
  }

  public async unload() {
    document.getElementById('zotero-itemmenu').removeEventListener('popupshowing', this, false)
  }

  public handleEvent(event) {
    const selectedItems = Zotero.getActiveZoteroPane().getSelectedItems()
    this.selectedItem = selectedItems.length ? selectedItems[0] : null

    if (selectedItems.length !== 1 || !this.selectedItem || !this.selectedItem.isRegularItem() || !this.selectedItem.getField('DOI')) {
      this.selectedItem = null
    }

    document.getElementById('menu-scite-get-link').hidden = !this.selectedItem
  }

  public run(method, ...args) {
    this[method].apply(this, args).catch(err => Zotero.logError(`${method}: ${err}`))
  }

  public async getTalliesForDOI() {
    const doi = this.selectedItem ? this.selectedItem.getField('DOI') : ''
    if (!doi) {
      alert('No DOI')
      return
    }

    await Zotero.Scite.refreshTallies(doi)
  }

  public async viewSciteReport() {
    const doi = this.selectedItem ? this.selectedItem.getField('DOI') : ''
    if (!doi) {
      alert('No DOI')
      return
    }

    await Zotero.Scite.viewSciteReport(doi)
  }
}

// Monkey patch because of https://groups.google.com/forum/#!topic/zotero-dev/zy2fSO1b0aQ
$patch$(Zotero.getActiveZoteroPane(), 'serializePersist', original => function() {
  original.apply(this, arguments)

  let persisted
  if (Zotero.Scite.uninstalled && (persisted = Zotero.Prefs.get('pane.persist'))) {
    persisted = JSON.parse(persisted)
    delete persisted['zotero-items-column-supporting']
    delete persisted['zotero-items-column-mentioning']
    delete persisted['zotero-items-column-disputing']
    Zotero.Prefs.set('pane.persist', JSON.stringify(persisted))
  }
})

window.addEventListener('load', event => {
  SciteZoteroPane.load().catch(err => Zotero.logError(err))
}, false)
window.addEventListener('unload', event => {
  SciteZoteroPane.unload().catch(err => Zotero.logError(err))
}, false)

export = SciteZoteroPane

// otherwise this entry point won't be reloaded: https://github.com/webpack/webpack/issues/156
delete require.cache[module.id]
